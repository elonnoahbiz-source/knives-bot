const { Telegraf } = require('telegraf');
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

// ==========================================
// 🛠️ FILL IN YOUR PRIVATE KEYS HERE 🛠️
// ==========================================
const SB_URL = "https://dptjeumndtrgfaxtlwim.supabase.co"; 
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwdGpldW1uZHRyZ2ZheHRsd2ltIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQ0NTk5MiwiZXhwIjoyMDkyMDIxOTkyfQ.Oc3eiwbo0p4vArLqFuNKdYKLF7mhtNZ42NS5EPkl4uM;
const TG_TOKEN = "7883530863:AAEZAn-g8qZT3Lo72zgb";
// ==========================================

// 1. Setup Database & Bot
const supabase = createClient(SB_URL, SB_KEY);
const bot = new Telegraf(TG_TOKEN);
const app = express();
const PORT = process.env.PORT || 10000;

// Helper: Get or Create User in DB
async function getAccount(userId, username) {
  try {
    let { data, error } = await supabase.from('users').select('*').eq('user_id', userId).single();
    
    if (!data) {
      const { data: newUser } = await supabase
        .from('users')
        .insert([{ user_id: userId, username: username || 'unknown', balance: 1000 }])
        .select()
        .single();
      return newUser;
    }
    return data;
  } catch (e) {
    console.log("Database Error:", e);
    return null;
  }
}

// Helper: Update Balance
async function updateBal(userId, newBal) {
  await supabase.from('users').update({ balance: newBal }).eq('user_id', userId);
}

// Health Check for Render
app.get('/', (req, res) => res.send('KNIVES DEALER VAULT IS SECURED'));

// BOT COMMANDS
bot.start(async (ctx) => {
  const user = await getAccount(ctx.from.id, ctx.from.username);
  if (user) {
    ctx.reply(`🔪 WELCOME TO THE PIT, ${ctx.from.first_name}.\n💰 Balance: ${user.balance} K-Credits\n\n/roll [amount] - Gamble your credits\n/balance - Check your bag`);
  }
});

bot.command('balance', async (ctx) => {
  const user = await getAccount(ctx.from.id, ctx.from.username);
  if (user) {
    ctx.reply(`💰 Your Current Balance: ${user.balance} K-Credits`);
  }
});

bot.command('roll', async (ctx) => {
  const userId = ctx.from.id;
  const user = await getAccount(userId, ctx.from.username);
  const text = ctx.message.text.split(' ');
  const bet = parseInt(text[1]);

  if (!user) return;
  if (!bet || bet <= 0) return ctx.reply("❌ Usage: /roll [amount]\nExample: /roll 100");
  if (user.balance < bet) return ctx.reply("💀 You're broke, kid. Use /balance.");

  // Deduct bet
  let currentBal = user.balance - bet;
  await updateBal(userId, currentBal);

  ctx.replyWithDice().then((msg) => {
    const value = msg.dice.value;
    
    // Wait for dice animation
    setTimeout(async () => {
      if (value >= 4) { // WIN on 4, 5, 6
        const winAmount = bet * 2;
        currentBal += winAmount;
        await updateBal(userId, currentBal);
        ctx.reply(`✅ WINNER! You rolled a ${value}.\n💰 Won: ${winAmount}\nNew Balance: ${currentBal}`);
      } else { // LOSS on 1, 2, 3
        ctx.reply(`💀 LOSS. You rolled a ${value}.\nNew Balance: ${currentBal}`);
      }
    }, 3500);
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Start Bot
bot.launch().then(() => {
  console.log("Bot is alive on Telegram!");
});

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
