const { Telegraf } = require('telegraf');

// This connects to the bot you made in BotFather
const bot = new Telegraf(process.env.BOT_TOKEN);

// What happens when you first message the bot
bot.start((ctx) => {
  ctx.reply("🔪 KNIVES DEALER IS LIVE.\n\nType /roll to gamble!");
});

// The basic dice game command
bot.command('roll', (ctx) => {
  ctx.replyWithDice();
});

// Keep the bot running
bot.launch();

// Safety stops
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
