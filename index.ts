import axios from 'axios'
import CryptoJS from 'crypto-js'
import prompt from 'prompt-sync'
import moment from 'moment'
import colors from 'colors'
import { Client, Intents, TextChannel, MessageEmbed } from 'discord.js'
import terminalImage from 'terminal-image'
import sharp from 'sharp'
import dotenv from 'dotenv'

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

let mobile = process.env.cowin_phone_number
let txnId: string | null = null
let token: string | null = null
let beneficiaries: any = null
let centers: any[] = []
let captcha: string | null = null
let channels: TextChannel[] = []

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

const parseCenters = async () => {
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
    colors.bold.yellow('%d') +
      ' open sessions! - ' +
      colors.bold.yellow('%d slots'),
    allOpenSessions.length,
    allOpenSessions.reduce((tot, session) => {
      return tot + session.available_capacity
    }, 0)
  )
  allOpenSessions.forEach((session) => {
    console.log(
      colors.dim(
        `${session.available_capacity} - ${session.vaccine}, ${session.name}: ${session.address}`
      )
    )
  })
  all18PlusOpenSessions = allOpenSessions.filter(
    (session) => session.min_age_limit == 18
  )
  console.log(
    colors.bold.green('%d') +
      ' open 18+ sessions! - ' +
      colors.bold.green('%d slots'),
    all18PlusOpenSessions.length,
    all18PlusOpenSessions.reduce((tot, session) => {
      return tot + session.available_capacity
    }, 0)
  )
  all18PlusOpenSessions.forEach((session) => {
    console.log(
      `${session.available_capacity} - ${session.vaccine}, ${session.name}: ${session.address}`
    )
  })
  console.log()
  if (channels.length > 0 && all18PlusOpenSessions.length > 0) {
    const embed = new MessageEmbed()
      .setTitle(
        `**${all18PlusOpenSessions.length}** 18+ open sessions! - ` +
          `*${all18PlusOpenSessions.reduce((tot, session) => {
            return tot + session.available_capacity
          }, 0)} slots*`
      )
      .setColor(0x4fff7e)
      .setDescription(
        '```' +
          all18PlusOpenSessions
            .map((session) => {
              return `${session.available_capacity} - ${session.vaccine}, ${session.name}: ${session.address}`
            })
            .join('\n') +
          '\n```'
      )
    try {
      await Promise.all(
        channels.map((channel) =>
          channel.send(
            embed
            // `**${all18PlusOpenSessions.length}** open sessions! - ` +
            //   `*${all18PlusOpenSessions.reduce((tot, session) => {
            //     return tot + session.available_capacity
            //   }, 0)} slots*\n\`\`\`` +
            //   all18PlusOpenSessions
            //     .map((session) => {
            //       return `${session.available_capacity} - ${session.vaccine}, ${session.name}: ${session.address}`
            //     })
            //     .join('\n') +
            //   '\n```'
          )
        )
      )
    } catch (e) {}
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

;(async () => {
  setupDiscordClient()

  if (token === undefined || token === null) {
    let otp = null
    do {
      if (otp !== null) {
        console.log('Wait for 3 minutes to get a text')
      }
      await generateMobileOTP()
      console.log(txnId)
      otp = prompt()('Enter OTP: ')
    } while (otp === 'resend')
    await verifyOTP(otp)
  }
  console.log(token)
  // await getBeneficiaries()
  // await getAppointmentSlots()
  // await parseCenters()
  // setInterval(async () => {
  //   await getAppointmentSlots()
  //   parseCenters()
  // }, 5000)
  // await getRecaptcha()
})()
