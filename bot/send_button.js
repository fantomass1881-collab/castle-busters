const fetch = require('node-fetch');

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID; // numeric
const PUBLIC_URL = process.env.PUBLIC_URL; // include https:// prefix

if (!BOT_TOKEN || !CHAT_ID || !PUBLIC_URL) {
  console.error('Usage: Set BOT_TOKEN, CHAT_ID and PUBLIC_URL environment variables.');
  console.error('Example: BOT_TOKEN=123:ABC CHAT_ID=8908761058 PUBLIC_URL=https://abcd1234.ngrok.io node send_button.js');
  process.exit(1);
}

const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
const payload = {
  chat_id: CHAT_ID,
  text: 'Play Castle Busters',
  reply_markup: {
    inline_keyboard: [[{
      text: 'Играть',
      web_app: { url: `${PUBLIC_URL.replace(/\/$/, '')}/index.html` }
    }]]
  }
};

fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
})
.then(res => res.json())
.then(json => {
  console.log('Telegram response:', JSON.stringify(json, null, 2));
})
.catch(err => {
  console.error('Send button error', err);
});
