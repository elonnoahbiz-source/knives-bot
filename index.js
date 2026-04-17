const { Telegraf } = require('telegraf');
const express = require('express');

const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();
const PORT = process.env.PORT || 3000;

// This makes Render think we are a website so it doesn't kill us
app.get('/', (req, res) => {
  res.send('KNIVES DEALER IS ONLINE');
});

// Bot Commands
bot.start((ctx) => ctx.reply("🔪 KNIVES DEALER IS LIVE. Type /roll to play."));
bot.command('roll', (ctx) => ctx.replyWithDice());

// Start the Express server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// Start the Bot
bot.launch().then(() => {
  console.log('Bot is running on Telegram...');
});

// Safety stops
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
