import CryptoJS from 'crypto-js'
import dotenv from 'dotenv'

dotenv.config()

export const AEShelper = CryptoJS.lib.Cipher._createHelper(
  CryptoJS.algo.AES as any
)

export const headers = {
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
