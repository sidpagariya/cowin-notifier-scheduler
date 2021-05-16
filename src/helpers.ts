import axios from 'axios'
import { headers } from './constants'

export const postRequest = (url: string, payload: any, token?: string) => {
  return token !== undefined
    ? axios.post(url, payload, {
        headers: { ...headers, authorization: `Bearer ${token}` },
      })
    : axios.post(url, payload, { headers: headers })
}

export const getRequest = (url: string, token?: string) => {
  return token !== undefined
    ? axios.get(url, {
        headers: { ...headers, authorization: `Bearer ${token}` },
      })
    : axios.get(url, { headers: headers })
}
