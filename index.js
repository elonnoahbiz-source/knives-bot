const { Telegraf } = require('telegraf');

// Use the token from our environment variables
const bot = new Telegraf(process.env.BOT_TOKEN);

// The simple start command
bot.start((ctx) => {
  ctx.reply("🔪 KNIVES DEALER IS LIVE.\n\nType /roll to gamble!");
});

// The dice game
bot.command('roll', (ctx) => {
  ctx.replyWithDice();
});

// Start the bot using "Polling" (The easiest way)
bot.launch().then(() => {
    console.log("Bot is running...");
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
