# CoWIN Discord Notifier
Discord Notifier for India's CoWIN 18+ covid vaccine appointments

![demo-screenshot](cowin-screenshot.png "Demo Screenshot")


## Setup
After cloning this repository, create a `.env` file in the repo with the following contents:
```bash
cowin_discord_bot_token=ENTER_DISCORD_BOT_TOKEN_HERE # for example AAAAAAAAAAAAAAAAAAAAAAAA.XXXXXX.YYYYYYYYYYYYYYYYYYYYYYYYYYY
cowin_phone_number=ENTER_PHONE_NUMBER_HERE # for example 1234567890
cowin_district=ENTER_DISTRICT_NUMBER_HERE # for example 389
cowin_whitelist_vaccine_types=ENTER_TYPES_HERE # either COVISHIELD,COVAXIN or just COVISHIELD or COVAXIN
cowin_whitelist_center_ids=ENTER_CENTER_IDS_HERE # either a single one like 594721 or multiple like 695512,695508,609123,561538,695505,569351
cowin_whitelist_times=ENTER_TIMERANGE_HERE # for example 00:00-23:59 (in 24-hour format)
cowin_whitelist_beneficiaries=ENTER_BENEFICIARIES_HERE # either a single one like 20123456789000 or multiple like 20123456789000,20123456789111,20123456789222
```

Make sure to replace the right side with the appropriate information. After you create a discord bot, drop the bot's token in the first variable, then your phone number for a one-time authentication (and in the future, for scheduling appointments quickly), and finally the district number for the district you want to fetch vaccine information for (To find the district number, please follow the steps below)

### How to find your state and then district number
1. Visit https://cdn-api.co-vin.in/api/v2/admin/location/states to find your state and the `state_id` corresponding it (For example, for Maharashtra, it is `21`)
2. Now, take your state number and append it at the end of the following URL: https://cdn-api.co-vin.in/api/v2/admin/location/districts/ (For example, for Maharashtra, it will be https://cdn-api.co-vin.in/api/v2/admin/location/districts/21).
3. Visit this new url to find out the `district_id` corresponding to your district to get the district number (for example, for the Nashik district in Maharashtra, it is 389).

### Install dependencies
Install all dependencies with the following command (using yarn) in the repo folder:
```
yarn
```
Make sure you also have `ts-node` installed, otherwise use either yarn (`yarn add --global ts-node`) or npm (`npm install -g ts-node`) to install it.


## Running the application
Run the application with the following command:
```
ts-node index.ts
```