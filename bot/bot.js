const { Telegraf } = require('telegraf');

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('Error: BOT_TOKEN environment variable is not set.');
  console.error('Set BOT_TOKEN and run: BOT_TOKEN=123:ABC node bot.js');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

bot.start(async (ctx) => {
  await ctx.reply('Castle Busters bot is running.');
});

bot.on('message', async (ctx) => {
  try {
    if (ctx.message && ctx.message.web_app_data) {
      // Web App sent data via Telegram.WebApp.sendData(...)
      let payload = ctx.message.web_app_data.data;
      try { payload = JSON.parse(payload); } catch (e) { /* keep raw */ }
      console.log('Received web_app_data from user', ctx.from.id, payload);
      await ctx.reply('Результат получен — спасибо!');
    } else {
      // Generic message
      console.log('Message from', ctx.from.id, ctx.message.text || '(no text)');
    }
  } catch (err) {
    console.error('Failed to handle message', err);
  }
});

bot.launch().then(() => console.log('Bot started')).catch(err => console.error('Bot failed to start', err));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
