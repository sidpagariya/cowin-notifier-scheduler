import CryptoJS from 'crypto-js'
import dotenv from 'dotenv'

dotenv.config()

export const AEShelper = CryptoJS.lib.Cipher._createHelper(
  CryptoJS.algo.AES as any
)

export const headers = (arogya: boolean = false) => ({
  accept: 'application/json, text/plain, */*',
  'accept-language': 'en-US,en;q=0.9,es-US;q=0.8,es;q=0.7',
  'content-type': 'application/json',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'cross-site',
  cache: 'no-store',
  origin: arogya
    ? 'https://web.swaraksha.gov.in'
    : 'https://selfregistration.cowin.gov.in',
  referer: arogya
    ? 'https://web.swaraksha.gov.in/'
    : 'https://selfregistration.cowin.gov.in/',
  referrerPolicy: 'strict-origin-when-cross-origin',
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_16_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.8.107.794 Safari/537.36',
})

export const URLS = {
  GENERATE_OTP: 'https://cdn-api.co-vin.in/api/v2/auth/generateMobileOTP',
  VERIFY_OTP: 'https://cdn-api.co-vin.in/api/v2/auth/validateMobileOtp',
  STATES: 'https://cdn-api.co-vin.in/api/v2/admin/location/states',
  DISTRICTS: (state_id: number) =>
    `https://cdn-api.co-vin.in/api/v2/admin/location/districts/${state_id}`,
  BENEFICIARIES: 'https://cdn-api.co-vin.in/api/v2/appointment/beneficiaries',
  CALENDAR: (district: number, date: string) =>
    `https://cdn-api.co-vin.in/api/v2/appointment/sessions/calendarByDistrict?district_id=${district}&date=${date}`,
  FIND_SESSIONS: (district: number, date: string) =>
    `https://cdn-api.co-vin.in/api/v2/appointment/sessions/findByDistrict?district_id=${district}&date=${date}`,
  PUBLIC_CALENDAR: (district: number, date: string) =>
    `https://cdn-api.co-vin.in/api/v2/appointment/sessions/public/calendarByDistrict?district_id=${district}&date=${date}`,
  PUBLIC_FIND_SESSIONS: (district: number, date: string) =>
    `https://cdn-api.co-vin.in/api/v2/appointment/sessions/public/findByDistrict?district_id=${district}&date=${date}`,
  RECAPTCHA: 'https://cdn-api.co-vin.in/api/v2/auth/getRecaptcha',
  SCHEDULE: 'https://cdn-api.co-vin.in/api/v2/appointment/schedule',
}

export const AROGYASETU_URLS = {
  GENERATE_OTP:
    'https://fp.swaraksha.gov.in/api/v3/cowin/single/cowin_remote_generate_otp',
  VERIFY_OTP:
    'https://fp.swaraksha.gov.in/api/v3/cowin/single/cowin_remote_validate_otp',
  STATES: (token: string) =>
    `https://fp.swaraksha.gov.in/api/v3/cowin/get_states_list?token=${token}`,
  DISTRICTS: (state_id: number, token: string) =>
    `https://fp.swaraksha.gov.in/api/v3/cowin/get_district_list?stateid=${state_id}&token=${token}`,
  CENTERS: (district: number, date: string, token: string) =>
    `https://fp.swaraksha.gov.in/api/v3/cowin/appointment/centersByDistrict?distCode=${district}&token=${token}&date=${date}`,
  BENEFICIARIES:
    'https://fp.swaraksha.gov.in/api/v3/cowin/cowin_remote_get_beneficiaries',
  SCHEDULE: 'https://fp.swaraksha.gov.in/api/v3/cowin/scheduleAppointment',
}
