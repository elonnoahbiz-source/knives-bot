const { Telegraf } = require('telegraf');
const express = require('express');

const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();

// Render gives us a URL, we need to tell Telegram to send messages there
const URL = process.env.RENDER_EXTERNAL_URL; 
const PORT = process.env.PORT || 3000;

// Setup the Webhook
bot.telegram.setWebhook(`${URL}/bot${process.env.BOT_TOKEN}`);
app.use(bot.webhookCallback(`/bot${process.env.BOT_TOKEN}`));

// Basic commands
bot.start((ctx) => ctx.reply("🔪 KNIVES DEALER IS LIVE."));
bot.command('roll', (ctx) => ctx.replyWithDice());

// Render needs to see a "Home Page" to stay alive
app.get('/', (req, res) => res.send('Bot is Running!'));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
