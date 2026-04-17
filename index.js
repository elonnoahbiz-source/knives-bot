const { Telegraf } = require('telegraf');
const http = require('http');

// 1. THE HEARTBEAT (This fixes the Render error)
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('KNIVES DEALER IS RUNNING\n');
});

// Render gives us a port automatically, we must use it
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Heartbeat monitoring on port ${PORT}`);
});

// 2. THE BOT LOGIC
const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) => {
  ctx.reply("🔪 KNIVES DEALER IS LIVE.\n\nType /roll to gamble!");
});

bot.command('roll', (ctx) => {
  ctx.replyWithDice();
});

bot.launch();

// Safety stops
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
