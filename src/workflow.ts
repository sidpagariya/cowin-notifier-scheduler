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

class Workflow {
  protected mainInterval!: number
  protected inProgressScheduling!: boolean
  protected mobile!: string
  protected district!: number
  protected mainToken: string | undefined
  protected beneficiaries: any
  protected centers!: any[]
  protected captcha: string | undefined
  protected channels!: TextChannel[]
  protected prevEmbed: MessageEmbed | undefined
  protected min_age!: number
  protected wl_vaccine_types: string[] | undefined
  protected wl_center_ids: number[] | undefined
  protected wl_beneficiaries: string[] | undefined
  protected wl_dose!: number

  private confirmAndInitializeFromEnv() {
    if (
      process.env.cowin_phone_number === undefined ||
      process.env.cowin_district === undefined
    ) {
      console.log(
        colors.red.bold(
          'cowin_phone_number and/or cowin_district missing from environment variables'
        )
      )
      process.exit(1)
    } else {
      this.mobile = process.env.cowin_phone_number
      this.district = parseInt(process.env.cowin_district)
      this.min_age = process.env.cowin_under_45 !== undefined ? 18 : 45
      this.wl_vaccine_types =
        process.env.cowin_whitelist_vaccine_types !== undefined
          ? process.env.cowin_whitelist_vaccine_types.split(',')
          : undefined
      this.wl_center_ids =
        process.env.cowin_whitelist_center_ids !== undefined
          ? process.env.cowin_whitelist_center_ids.split(',').map((x) => +x)
          : undefined
      this.wl_beneficiaries =
        process.env.cowin_whitelist_beneficiaries !== undefined
          ? process.env.cowin_whitelist_beneficiaries.split(',')
          : undefined
      this.wl_dose =
        process.env.cowin_whitelist_dose !== undefined
          ? parseInt(process.env.cowin_whitelist_dose)
          : 1
    }
  }

  constructor() {
    this.mainInterval = 0
    this.inProgressScheduling = false
    this.centers = []
    this.channels = []
    this.confirmAndInitializeFromEnv()
  }
}
