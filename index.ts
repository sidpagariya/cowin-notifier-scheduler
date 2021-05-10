import axios from 'axios'
import CryptoJS from 'crypto-js'
import prompt from 'prompt-sync'
import moment from 'moment'
import colors from 'colors'
import { Client, Intents, TextChannel, MessageEmbed } from 'discord.js'
import terminalImage from 'terminal-image'
import sharp from 'sharp'
import dotenv from 'dotenv'
import { readFileSync, writeFileSync } from 'fs'
// import serverline from 'serverline'

dotenv.config()

let AEShelper = CryptoJS.lib.Cipher._createHelper(CryptoJS.algo.AES as any)

let headers = {
  accept: 'application/json, text/plain, */*',
  'accept-language': 'en-US,en;q=0.9,es-US;q=0.8,es;q=0.7',
  'content-type': 'application/json',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'cross-site',
  cache: 'no-store',
  origin: 'https://selfregistration.cowin.gov.in',
  referer: 'https://selfregistration.cowin.gov.in/',
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_16_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.8.107.794 Safari/537.36',
}

let mainInterval: number = 0
let inProgressScheduling: boolean = false
let mobile = process.env.cowin_phone_number
let txnId: string | undefined = undefined
let token: string | undefined = undefined
let beneficiaries: any = undefined
let centers: any[] = []
let captcha: string | undefined = undefined
let channels: TextChannel[] = []
let prevEmbed: MessageEmbed | undefined = undefined
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

const generateMobileOTP = async () => {
  txnId = (
    await axios.post(
      'https://cdn-api.co-vin.in/api/v2/auth/generateMobileOTP',
      JSON.stringify({
        secret: AEShelper.encrypt(
          'b5cab167-7977-4df1-8027-a63aa144f04e',
          'CoWIN@$#&*(!@%^&',
          undefined
        ).toString(),
        mobile: mobile,
      }),
      {
        headers: headers,
      }
    )
  ).data.txnId
}

const verifyOTP = async (otp: string) => {
  token = (
    await axios.post(
      'https://cdn-api.co-vin.in/api/v2/auth/validateMobileOtp',
      JSON.stringify({
        otp: CryptoJS.SHA256(otp).toString(),
        txnId: txnId,
      }),
      {
        headers: headers,
      }
    )
  ).data.token
  writeFileSync('token.txt', token ?? '')
}

const getBeneficiaries = async () => {
  beneficiaries = (
    await axios.get(
      'https://cdn-api.co-vin.in/api/v2/appointment/beneficiaries',
      {
        headers: { ...headers, authorization: `Bearer ${token}` },
      }
    )
  ).data.beneficiaries
  beneficiaries.forEach((beneficiary: any, idx: number) => {
    console.log(
      `%d. ${colors.bold.bgYellow.black('%s')} (%d)`,
      idx,
      beneficiary.name,
      beneficiary.beneficiary_reference_id
    )
  })
}

const getAppointmentSlots = async () => {
  let date = moment(new Date())
  if (date.hour() >= 16) {
    date.add(1, 'day')
  }

  await axios
    .get(
      `https://cdn-api.co-vin.in/api/v2/appointment/sessions/calendarByDistrict?district_id=${
        process.env.cowin_district
      }&date=${date.format('DD-MM-YYYY')}`,
      {
        headers: { ...headers, authorization: `Bearer ${token}` },
      }
    )
    .then((res) => {
      centers = res.data.centers
      // console.log(centers)
    })
    .catch((err) => {
      console.log(colors.red.italic(`Error getting appointment slots`))
    })
}

const getRecaptcha = async () => {
  captcha = (
    await axios.post(
      'https://cdn-api.co-vin.in/api/v2/auth/getRecaptcha',
      '{}',
      {
        headers: { ...headers, authorization: `Bearer ${token}` },
      }
    )
  ).data.captcha

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
    await axios.post(
      'https://cdn-api.co-vin.in/api/v2/appointment/schedule',
      JSON.stringify({
        center_id: center_id,
        session_id: session_id,
        beneficiaries: beneficiaries,
        slot: slot,
        captcha: captcha,
        dose: dose,
      }),
      {
        headers: { ...headers, authorization: `Bearer ${token}` },
      }
    )
  ).data
  console.log(data)
}

const parseCenters = async (bookingEnabled: boolean) => {
  if (inProgressScheduling) return
  let allSessions: any[] = []
  let allOpenSessions: any[] = []
  let all18PlusOpenSessions: any[] = []
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
        `${session.available_capacity} - ${session.vaccine}, ${session.name}: ${session.address} (${session.center_id})`
      )
    )
  })

  all18PlusOpenSessions = allOpenSessions.filter(
    (session) => session.min_age_limit == 18
  )
  console.log(
    colors.bold.green('%d slots') +
      ' from ' +
      colors.bold.green('%d') +
      ' open 18+ sessions!',
    all18PlusOpenSessions.reduce((tot, session) => {
      return tot + session.available_capacity
    }, 0),
    all18PlusOpenSessions.length
  )
  all18PlusOpenSessions.forEach((session) => {
    console.log(
      `${session.available_capacity} - ${session.vaccine}, ${session.name}: ${session.address} (${session.center_id})`
    )
  })

  console.log()

  if (bookingEnabled && all18PlusOpenSessions.length > 0) {
    inProgressScheduling = true
    all18PlusOpenSessions.every(async (session: any) => {
      if (
        (wl_center_ids !== undefined &&
          wl_center_ids.indexOf(session.center_id) !== -1) ||
        wl_center_ids === undefined
      ) {
        if (
          (wl_vaccine_types !== undefined &&
            wl_vaccine_types.indexOf(session.vaccine) !== -1) ||
          wl_vaccine_types === undefined
        ) {
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
              enteredRecaptcha
            )
            console.log(colors.green.bold('***APPOINTMENT(S) CONFIRMED***'))
            process.exit(0)
          } catch (err) {
            console.log(colors.red.bold('***APPOINTMENT(S) BOOKING FAILED***'))
          }
          // TODO: output for who the appointment(s) were booked
          // console.log(colors.green.bold("***APPOINTMENT(S) CONFIRMED FOR: " + (wl_beneficiaries !== undefined ? beneficiaries.map()) +"***"))
        }
      }
      return true
    })
    inProgressScheduling = false
    await startPollingForSlots(bookingEnabled, true)
  }

  if (channels.length > 0 && allOpenSessions.length > 0) {
    const embed = new MessageEmbed()
      .setTitle(
        `**${allOpenSessions.reduce((tot, session) => {
          return tot + session.available_capacity
        }, 0)} slots** from ` +
          `*${allOpenSessions.length}* open 18+ sessions! - `
      )
      .setColor(0x4fff7e)
      .setDescription(
        '```' +
          allOpenSessions
            .map((session) => {
              return `${session.available_capacity} - ${session.vaccine}, ${session.name}: ${session.address}`
            })
            .join('\n') +
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
}

const client = new Client({
  intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES],
} as any)

const setupDiscordClient = () => {
  client.on('ready', () => {
    if (client && client.user) {
      console.log(`Logged in as ${client.user.tag}!`)
      // console.log(client.channels)

      channels = (Array.from(client.channels.cache.values()).filter(
        (c) => c.type === 'text'
      ) as unknown) as TextChannel[]
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
    await generateMobileOTP()
    console.log(txnId)
    let invalidOtp = true
    do {
      otp = prompt()('Enter OTP (type resend to send a new one): ')
      try {
        await verifyOTP(otp)
        invalidOtp = false
      } catch (err) {
        console.log(err)
      }
    } while (invalidOtp)
  } while (otp === 'resend')
  console.log(`Token: ${colors.magenta('%s')}`, token)
}

const startPollingForSlots = async (
  bookingEnabled: boolean,
  skipInitial: boolean = false
) => {
  if (!skipInitial) {
    await getAppointmentSlots()
    await parseCenters(bookingEnabled)
  }
  mainInterval = (setInterval(async () => {
    await getAppointmentSlots()
    parseCenters(bookingEnabled)
  }, 5000) as unknown) as number
}

const runWorkflow = async (
  printEnv: boolean = false,
  setupDiscord: boolean = true,
  bookingEnabled: boolean = false
) => {
  !printEnv || printEnvConfig()
  !setupDiscord || setupDiscordClient()
  try {
    token = readFileSync('token.txt').toString()
  } catch (err) {}
  token ?? (await getAndVerifyOTP())
  // await getBeneficiaries()
  await startPollingForSlots(bookingEnabled)
  // await getRecaptcha()
}

runWorkflow(true, false)
