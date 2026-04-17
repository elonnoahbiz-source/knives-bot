const { Telegraf } = require('telegraf');
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

// 1. Setup Database & Bot
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();
const PORT = process.env.PORT || 3000;

// Helper: Get or Create User in DB
async function getAccount(userId, username) {
  let { data, error } = await supabase.from('users').select('*').eq('user_id', userId).single();
  
  if (!data) {
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([{ user_id: userId, username: username || 'unknown', balance: 1000 }])
      .select()
      .single();
    return newUser;
  }
  return data;
}

// Helper: Update Balance
async function updateBal(userId, newBal) {
  await supabase.from('users').update({ balance: newBal }).eq('user_id', userId);
}

app.get('/', (req, res) => res.send('KNIVES DEALER VAULT IS SECURED'));

bot.start(async (ctx) => {
  const user = await getAccount(ctx.from.id, ctx.from.username);
  ctx.reply(`🔪 WELCOME TO THE PIT.\n💰 Balance: ${user.balance} K-Credits\n\n/roll [amount] to gamble.`);
});

bot.command('balance', async (ctx) => {
  const user = await getAccount(ctx.from.id, ctx.from.username);
  ctx.reply(`💰 Your Current Balance: ${user.balance} K-Credits`);
});

bot.command('roll', async (ctx) => {
  const userId = ctx.from.id;
  const user = await getAccount(userId, ctx.from.username);
  const text = ctx.message.text.split(' ');
  const bet = parseInt(text[1]);

  if (!bet || bet <= 0) return ctx.reply("❌ Usage: /roll [amount]");
  if (user.balance < bet) return ctx.reply("💀 Insufficient funds.");

  let currentBal = user.balance - bet;
  await updateBal(userId, currentBal);

  ctx.replyWithDice().then((msg) => {
    const value = msg.dice.value;
    setTimeout(async () => {
      if (value >= 4) {
        currentBal += (bet * 2);
        await updateBal(userId, currentBal);
        ctx.reply(`✅ WIN! Rolled ${value}.\n💰 Balance: ${currentBal}`);
      } else {
        ctx.reply(`💀 LOSS. Rolled ${value}.\n💰 Balance: ${currentBal}`);
      }
    }, 3500);
  });
});

app.listen(PORT, () => console.log(`Live on ${PORT}`));
bot.launch();
