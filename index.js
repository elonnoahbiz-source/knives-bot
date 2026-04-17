const { Telegraf } = require('telegraf');
const http = require('http');

// 1. THIS IS THE FIX: A tiny web server to satisfy Render
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('KNIVES DEALER IS ONLINE');
});

// Render gives us a Port, we MUST listen to it or it will crash
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Port ${PORT} is open for Render.`);
});

// 2. THE BOT LOGIC
const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) => {
  ctx.reply("🔪 KNIVES DEALER IS LIVE.\n\nType /roll to gamble!");
});

bot.command('roll', (ctx) => {
  ctx.replyWithDice();
});

// Start the bot
bot.launch().then(() => {
  console.log("Bot is successfully connected to Telegram.");
});

// Essential safety for free hosting
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
