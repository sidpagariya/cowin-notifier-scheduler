import express from 'express'
import bodyParser from 'body-parser'

const app = express()
const port = 3000
let currentTxnId: string

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

app.post('/', (req, res) => {
  let otp = parseInt(req.body.text.split('is ')[1].split('.')[0])
  console.log(`Received OTP: ${otp}`)
  if (currentTxnId !== undefined) {
    process.send!({ receivedOTP: otp, currentTxnId: currentTxnId })
  }
  res.send('Thanks!')
})

app.listen(port, () => {
  console.log(`OTP server listening at http://localhost:${port}`)
})

process.on('message', (message) => {
  currentTxnId = message.txnId
  console.log(`Setting current txnId to ${currentTxnId}`)
})
