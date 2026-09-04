Bot helper for Castle Busters (Telegraf)

This folder contains a minimal example bot that:
- Listens for messages and logs web_app_data (data sent from Telegram WebApp)
- Provides a helper script to send a message with a Web App inline button to a chat

Files:
- bot.js — example Telegraf bot. Reads BOT_TOKEN from env.
- send_button.js — sends a message with an inline "Играть" WebApp button. Reads BOT_TOKEN, CHAT_ID, PUBLIC_URL from env.
- package.json — dependencies and scripts.

How to run
1) Install dependencies:
   cd bot
   npm install

2) Start the bot (do NOT commit your BOT_TOKEN to git):
   BOT_TOKEN=<your_bot_token> npm start

3) Send a test WebApp button (in another terminal):
   BOT_TOKEN=<your_bot_token> CHAT_ID=8908761058 PUBLIC_URL=https://abcd1234.ngrok.io npm run send-button

Notes
- Replace CHAT_ID with your numeric chat id (you confirmed: 8908761058).
- PUBLIC_URL must be an HTTPS URL pointing to your running client (ngrok or deployed domain).
- The script send_button.js will call Telegram API to post a message with an inline Web App button. Clicking that button in Telegram will open the Web App at PUBLIC_URL/index.html.
- Do NOT share your BOT_TOKEN publicly. Store it securely.
