import axios from 'axios'
import { headers } from './constants'

export const postRequest = (
  url: string,
  payload: any,
  token?: string,
  arogya: boolean = false
) => {
  return token !== undefined
    ? axios.post(url, payload, {
        headers: {
          ...headers(arogya),
          authorization: `${arogya ? '' : 'Bearer '}${token}`,
        },
      })
    : axios.post(url, payload, { headers: headers(arogya) })
}

export const getRequest = (
  url: string,
  token?: string,
  arogya: boolean = false
) => {
  return token !== undefined
    ? axios.get(url, {
        headers: {
          ...headers(arogya),
          authorization: `${arogya ? '' : 'Bearer '}${token}`,
        },
      })
    : axios.get(url, { headers: headers(arogya) })
}
