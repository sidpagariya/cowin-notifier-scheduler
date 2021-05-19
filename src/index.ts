import axios from 'axios'
import CryptoJS from 'crypto-js'
import prompt from 'prompt-sync'
import moment from 'moment'
import colors from 'colors'
import { Client, Intents, TextChannel, MessageEmbed } from 'discord.js'
import terminalImage from 'terminal-image'
import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'fs'
import { AEShelper, headers, URLS } from './constants'
import { postRequest, getRequest } from './helpers'
// import serverline from 'serverline'

let mainInterval: number = 0
let inProgressScheduling: boolean = false
let mobile = process.env.cowin_phone_number
// let txnId: string | undefined = undefined
let mainToken: string | undefined = undefined
let beneficiaries: any = undefined
let centers: any[] = []
let sessions: any[] = []
let captcha: string | undefined = undefined
let channels: TextChannel[] = []
let prevEmbed: MessageEmbed | undefined = undefined
let min_age: number = process.env.cowin_under_45 !== undefined ? 18 : 45
let wl_vaccine_types: string[] | undefined =
  process.env.cowin_whitelist_vaccine_types !== undefined
    ? process.env.cowin_whitelist_vaccine_types.split(',')
    : undefined
let wl_center_ids: number[] | undefined =
  process.env.cowin_whitelist_center_ids !== undefined
    ? process.env.cowin_whitelist_center_ids.split(',').map((x) => +x)
    : undefined
let wl_beneficiaries: string[] | undefined =
  process.env.cowin_whitelist_beneficiaries !== undefined
    ? process.env.cowin_whitelist_beneficiaries.split(',')
    : undefined
let wl_dose: number =
  process.env.cowin_whitelist_dose !== undefined
    ? parseInt(process.env.cowin_whitelist_dose)
    : 1

const generateMobileOTP = async () => {
  return (
    await postRequest(
      URLS.GENERATE_OTP,
      JSON.stringify({
        secret: AEShelper.encrypt(
          'b5cab167-7977-4df1-8027-a63aa144f04e',
          'CoWIN@$#&*(!@%^&',
          undefined
        ).toString(),
        mobile: mobile,
      })
    )
  ).data.txnId
}

const verifyOTP = async (otp: string, txnId: string) => {
  let token = (
    await postRequest(
      URLS.VERIFY_OTP,
      JSON.stringify({
        otp: CryptoJS.SHA256(otp).toString(),
        txnId: txnId,
      })
    )
  ).data.token
  writeFileSync('token.txt', token ?? '')
  return token
}

const getBeneficiaries = async () => {
  beneficiaries = (await getRequest(URLS.BENEFICIARIES, mainToken)).data
    .beneficiaries
  beneficiaries.forEach((beneficiary: any, idx: number) => {
    console.log(
      `%d. ${colors.bold.bgYellow.black('%s')} (%d)`,
      idx,
      beneficiary.name,
      beneficiary.beneficiary_reference_id
    )
  })
}

const getAppointmentSlotsV1 = async (bookingEnabled: boolean) => {
  let date = moment(new Date())
  if (date.hour() >= 16) {
    date.add(1, 'day')
  }

  try {
    sessions = (
      await getRequest(
        bookingEnabled
          ? URLS.FIND_SESSIONS(
              parseInt(process.env.cowin_district as string),
              date.format('DD-MM-YYYY')
            )
          : URLS.PUBLIC_FIND_SESSIONS(
              parseInt(process.env.cowin_district as string),
              date.format('DD-MM-YYYY')
            ),
        bookingEnabled ? mainToken : undefined
      )
    ).data.sessions
  } catch (err) {
    console.log(colors.red.italic(`Error getting appointment slots`))
  }
}

const getAppointmentSlotsV2 = async (bookingEnabled: boolean) => {
  let date = moment(new Date())
  if (date.hour() >= 16) {
    date.add(1, 'day')
  }

  try {
    centers = (
      await getRequest(
        bookingEnabled
          ? URLS.CALENDAR(
              parseInt(process.env.cowin_district as string),
              date.format('DD-MM-YYYY')
            )
          : URLS.PUBLIC_CALENDAR(
              parseInt(process.env.cowin_district as string),
              date.format('DD-MM-YYYY')
            ),
        bookingEnabled ? mainToken : undefined
      )
    ).data.centers
  } catch (err) {
    console.log(
      colors.red.italic(
        `Error getting appointment slots: ${err.response.data.error}`
      )
    )
    console.log(err)
  }
}

const getRecaptcha = async () => {
  captcha = (await postRequest(URLS.RECAPTCHA, '{}', mainToken)).data.captcha

  if (captcha) {
    await sharp(
      Buffer.from(
        captcha.replace('width="150" height="50"', 'width="750" height="250"')
      )
    )
      .png({ compressionLevel: 0 })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .toFile('captcha.png')
    console.log(await terminalImage.file('captcha.png', { height: 5 }))
    return true
  } else {
    console.log("Didn't get proper captcha.")
    return false
  }
}

const scheduleAppointment = async (
  center_id: number,
  session_id: number,
  beneficiaries: string[],
  slot: string,
  captcha: string,
  dose: number = 1
) => {
  let data = (
    await postRequest(
      URLS.SCHEDULE,
      JSON.stringify({
        center_id: center_id,
        session_id: session_id,
        beneficiaries: beneficiaries,
        slot: slot,
        captcha: captcha,
        dose: dose,
      }),
      mainToken
    )
  ).data
  console.log(data)
}

const parseCentersV1 = async (bookingEnabled: boolean) => {
  if (inProgressScheduling) return
  let allOpenSessions: any[] = []
  let allFilteredOpenSessions: any[] = []

  sessions.map((session) => {
    if (session.available_capacity > 0) {
      allOpenSessions.push(session)
    }
  })

  allFilteredOpenSessions = allOpenSessions.filter(
    (session) => session.min_age_limit == min_age
  )

  await printParsedCenters(allOpenSessions, allFilteredOpenSessions)

  if (bookingEnabled && allFilteredOpenSessions.length > 0) {
    await bookAppointment(bookingEnabled, allFilteredOpenSessions)
  }

  if (channels.length > 0 && allFilteredOpenSessions.length > 0) {
    await sendDiscordNotifications(allFilteredOpenSessions)
  }
}

const parseCentersV2 = async (bookingEnabled: boolean) => {
  if (inProgressScheduling) return
  let allSessions: any[] = []
  let allOpenSessions: any[] = []
  let allFilteredOpenSessions: any[] = []
  centers.map((center: any) => {
    if (center.sessions && center.sessions.length > 0) {
      center.sessions.forEach((session: any) => {
        allSessions.push({
          ...session,
          name: center.name,
          block_name: center.block_name,
          address: center.address,
          center_id: center.center_id,
        })
      })
    }
  })
  allSessions.map((session) => {
    if (session.available_capacity > 0) {
      allOpenSessions.push(session)
    }
  })

  allFilteredOpenSessions = allOpenSessions.filter(
    (session) => session.min_age_limit == min_age
  )

  await printParsedCenters(allOpenSessions, allFilteredOpenSessions)

  if (bookingEnabled && allFilteredOpenSessions.length > 0) {
    await bookAppointment(bookingEnabled, allFilteredOpenSessions)
  }

  if (channels.length > 0 && allFilteredOpenSessions.length > 0) {
    await sendDiscordNotifications(allFilteredOpenSessions)
  }
}

const printParsedCenters = async (
  allOpenSessions: any[],
  allFilteredOpenSessions: any[]
) => {
  console.log(
    colors.blue.underline(moment(new Date()).format('DD-MM-YYYY HH:mm:ss'))
  )

  console.log(
    colors.bold.yellow('%d slots') +
      ' from ' +
      colors.bold.yellow('%d') +
      ' open sessions!',
    allOpenSessions.reduce((tot, session) => {
      return tot + session.available_capacity
    }, 0),
    allOpenSessions.length
  )
  allOpenSessions.forEach((session) => {
    console.log(
      colors.dim(
        `${session.available_capacity} - ${session.vaccine}, ${session.name}: ${session.address} (${session.center_id}) - ${session.date} - I (${session.available_capacity_dose1}), II (${session.available_capacity_dose2})`
      )
    )
  })

  console.log(
    colors.bold.green('%d slots') +
      ' from ' +
      colors.bold.green('%d') +
      ` open ${min_age}+ sessions!`,
    allFilteredOpenSessions.reduce((tot, session) => {
      return tot + session.available_capacity
    }, 0),
    allFilteredOpenSessions.length
  )
  allFilteredOpenSessions.forEach((session) => {
    console.log(
      `${session.available_capacity} - ${session.vaccine}, ${session.name}: ${session.address} (${session.center_id}) - ${session.date} - I (${session.available_capacity_dose1}), II (${session.available_capacity_dose2})`
    )
  })

  console.log()
}

const bookAppointment = async (
  bookingEnabled: boolean,
  allFilteredOpenSessions: any[]
) => {
  inProgressScheduling = true
  for (let i = 0; i < allFilteredOpenSessions.length; ++i) {
    let session = allFilteredOpenSessions[i]
    let centerGood =
        (wl_center_ids !== undefined &&
          wl_center_ids.indexOf(session.center_id) !== -1) ||
        wl_center_ids === undefined,
      vaccineTypeGood =
        (wl_vaccine_types !== undefined &&
          wl_vaccine_types.indexOf(session.vaccine) !== -1) ||
        wl_vaccine_types === undefined,
      beneficiariesCountGood =
        (wl_beneficiaries ?? beneficiaries).length <=
        (wl_dose === 1
          ? session.available_capacity_dose1
          : session.available_capacity_dose2)
    if (centerGood && vaccineTypeGood && beneficiariesCountGood) {
      // TODO: add check for time range
      // TODO: add check for whether enough slots available for all beneficiaries
      clearInterval(mainInterval)
      try {
        await getBeneficiaries()
      } catch (err) {
        await getAndVerifyOTP()
      }
      await getRecaptcha()
      let enteredRecaptcha = prompt()('Enter reCaptcha: ')
      try {
        await scheduleAppointment(
          session.center_id,
          session.session_id,
          wl_beneficiaries ?? beneficiaries,
          session.slots[session.slots.length - 1],
          enteredRecaptcha,
          wl_dose
        )
        console.log(colors.green.bold('***APPOINTMENT(S) CONFIRMED***'))
        process.exit(0)
      } catch (err) {
        console.log(
          colors.red.bold(
            `***APPOINTMENT(S) BOOKING FAILED: ${err.response.data.error}***`
          )
        )
      }
      // TODO: output for who the appointment(s) were booked
      // console.log(colors.green.bold("***APPOINTMENT(S) CONFIRMED FOR: " + (wl_beneficiaries !== undefined ? beneficiaries.map()) +"***"))
      await startPollingForSlots(bookingEnabled, true)
    }
  }
  inProgressScheduling = false
}

const createSessionDiscordText = (session: any) => {
  return [
    `Total capacity: ${session.available_capacity}`,
    `Total dose 1 capacity: ${session.available_capacity_dose1}`,
    `Total dose 2 capacity: ${session.available_capacity_dose2}\n`,
    `Center: ${session.name} (${session.pincode})`,
    `Vaccine: ${session.vaccine}\n`,
    `Date: ${session.date}`,
    `Fee: ${session.fee_type}`,
  ].join('\n')
}

const sendDiscordNotifications = async (allFilteredOpenSessions: any[]) => {
  const embed = new MessageEmbed()
    .setTitle(
      `**${allFilteredOpenSessions.reduce((tot, session) => {
        return tot + session.available_capacity
      }, 0)} slots** from ` +
        `*${allFilteredOpenSessions.length}* open ${min_age}+ sessions!`
    )
    .setColor(0x4fff7e)
    .setDescription(
      '```' +
        allFilteredOpenSessions
          .map((session) => {
            return createSessionDiscordText(session)
          })
          .join('\n\n\n') +
        '\n```'
    )
  if (
    prevEmbed === undefined ||
    prevEmbed.title !== embed.title ||
    prevEmbed.description !== embed.description
  ) {
    try {
      await Promise.all(channels.map((channel) => channel.send(embed)))
    } catch (e) {
      console.log(colors.red.italic(`Error sending some/all discord updates`))
    }
    prevEmbed = embed
  }
}

const client = new Client({
  intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES],
} as any)

const setupDiscordClient = () => {
  client.on('ready', () => {
    if (client && client.user) {
      console.log(`Logged in as ${client.user.tag}!`)
      // console.log(client.channels)

      channels = Array.from(client.channels.cache.values()).filter(
        (c) => c.type === 'text'
      ) as unknown as TextChannel[]
      // console.log(channels.length)
    }
  })

  client.login(process.env.cowin_discord_bot_token)
}

const printEnvConfig = () => {
  console.log(`======Starting with the following configuration====`)
  console.log(
    `Discord Bot token: ${colors.magenta('%s')}`,
    process.env.cowin_discord_bot_token
  )
  console.log(
    `Phone Number: ${colors.magenta('%s')}`,
    process.env.cowin_phone_number
  )
  console.log(
    `District Number: ${colors.magenta('%s')}`,
    process.env.cowin_district
  )
  if (process.env.cowin_whitelist_vaccine_types) {
    console.log(
      `Whitelisted Vaccine Types: ${colors.magenta('%s')}`,
      JSON.stringify(process.env.cowin_whitelist_vaccine_types.split(','))
    )
  }
  if (process.env.cowin_whitelist_center_ids) {
    console.log(
      `Whitelisted Centers: ${colors.magenta('%s')}`,
      JSON.stringify(wl_center_ids)
    )
  }
  if (process.env.cowin_whitelist_times) {
    console.log(
      `Whitelisted Times: ${colors.magenta('%s')}`,
      process.env.cowin_whitelist_times.split('-')[0] +
        ' to ' +
        process.env.cowin_whitelist_times.split('-')[1]
    )
  }
  if (process.env.cowin_whitelist_beneficiaries) {
    console.log(
      `Whitelisted Beneficiaries: ${colors.magenta('%s')}`,
      JSON.stringify(process.env.cowin_whitelist_beneficiaries.split(','))
    )
  }
  console.log(`======End of configuration====\n`)
}

const getAndVerifyOTP = async () => {
  let otp = undefined
  do {
    if (otp !== undefined) {
      console.log('Wait for up to 3 minutes to get a text and then try again')
    }
    let txnId = await generateMobileOTP()
    console.log(colors.magenta(txnId))
    let invalidOtp = true
    do {
      otp = prompt()('Enter OTP (type resend to send a new one): ')
      if (otp !== 'resend') {
        try {
          mainToken = await verifyOTP(otp, txnId)
          invalidOtp = false
        } catch (err) {
          // console.log(err)
        }
      } else {
        console.log(colors.yellow('Attempting to resend otp...'))
        invalidOtp = false
      }
    } while (invalidOtp)
  } while (otp === 'resend')
  console.log(`Token: ${colors.magenta('%s')}`, mainToken)
}

const startPollingForSlots = async (
  bookingEnabled: boolean,
  skipInitial: boolean = false
) => {
  if (!skipInitial) {
    // await getAppointmentSlotsV2(bookingEnabled)
    // await parseCentersV2(bookingEnabled)
    await getAppointmentSlotsV1(bookingEnabled)
    await parseCentersV1(bookingEnabled)
  }
  mainInterval = setInterval(async () => {
    // await getAppointmentSlotsV2(bookingEnabled)
    // await parseCentersV2(bookingEnabled)
    await getAppointmentSlotsV1(bookingEnabled)
    await parseCentersV1(bookingEnabled)
  }, 5000) as unknown as number
  if (bookingEnabled) {
    setInterval(async () => {
      await getAndVerifyOTP()
    }, 10 * 60000)
  }
}

const runWorkflow = async (
  printEnv: boolean = false,
  setupDiscord: boolean = true,
  bookingEnabled: boolean = false
) => {
  !printEnv || printEnvConfig()
  !setupDiscord || setupDiscordClient()
  if (bookingEnabled) {
    try {
      mainToken = readFileSync('token.txt').toString()
    } catch (err) {}
    mainToken ?? (await getAndVerifyOTP())
    console.log(`Token: ${colors.magenta('%s')}`, mainToken)

    try {
      await getBeneficiaries()
    } catch (err) {
      // await getAndVerifyOTP()
      try {
        await getBeneficiaries()
      } catch (err) {
        console.log(
          colors.red(
            'Error getting beneficiaries, most likely because there are none registered with this phone number'
          )
        )
        throw "Couldn't fetch beneficiaries"
      }
    }
  }
  await startPollingForSlots(bookingEnabled)
  // await getRecaptcha()
}

runWorkflow(true, false, true)
