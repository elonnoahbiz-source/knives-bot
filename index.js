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

const { Telegraf } = require('telegraf');
const express = require('express');

const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();
const PORT = process.env.PORT || 3000;

// LORD CODE: A temporary "Bank" (Warning: This resets if the bot restarts)
// We will move this to a permanent database in the next phase.
let bank = {};

app.get('/', (req, res) => { res.send('KNIVES DEALER IS ONLINE'); });

// 1. WELCOME & GIVE STARTING CREDITS
bot.start((ctx) => {
  const userId = ctx.from.id;
  if (!bank[userId]) {
    bank[userId] = 1000; // Give them 1,000 free credits to start
  }
  ctx.reply(`🔪 WELCOME TO THE PIT, ${ctx.from.first_name}.\n\n💰 Balance: ${bank[userId]} K-Credits\n\nCommands:\n/roll [amount] - Gamble credits\n/balance - Check your bag`);
});

// 2. CHECK BALANCE
bot.command('balance', (ctx) => {
  const userId = ctx.from.id;
  const bal = bank[userId] || 0;
  ctx.reply(`💰 Your Current Balance: ${bal} K-Credits`);
});

// 3. THE ACTUAL GAMBLE (High-Detail)
bot.command('roll', (ctx) => {
  const userId = ctx.from.id;
  const text = ctx.message.text.split(' ');
  const bet = parseInt(text[1]);

  // Check if they actually put a number
  if (!bet || bet <= 0) {
    return ctx.reply("❌ Usage: /roll [amount]\nExample: /roll 100");
  }

  // Check if they have enough money
  if (bank[userId] < bet) {
    return ctx.reply("💀 You're broke, kid. Use /balance to check.");
  }

  // Deduct the bet first
  bank[userId] -= bet;

  // Roll the dice
  ctx.replyWithDice().then((msg) => {
    const value = msg.dice.value;
    
    // Wait for the animation to stop (3 seconds)
    setTimeout(() => {
      if (value >= 4) { // 4, 5, 6 = WIN
        const winAmount = bet * 2;
        bank[userId] += winAmount;
        ctx.reply(`✅ WINNER! You rolled a ${value}.\n💰 Won: ${winAmount}\nNew Balance: ${bank[userId]}`);
      } else { // 1, 2, 3 = LOSS
        ctx.reply(`💀 LOSS. You rolled a ${value}.\nNew Balance: ${bank[userId]}`);
      }
    }, 3500);
  });
});

app.listen(PORT, () => { console.log(`Server on ${PORT}`); });
bot.launch();
