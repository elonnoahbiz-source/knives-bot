const { Telegraf } = require('telegraf');
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

// ==========================================
// 🛠️ PASTE YOUR ACTUAL STRINGS BETWEEN THE " "
// ==========================================
const my_url = "https://dptjeumndtrgfaxtlwim.supabase.co/"; 
const my_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwdGpldW1uZHRyZ2ZheHRsd2ltIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQ0NTk5MiwiZXhwIjoyMDkyMDIxOTkyfQ.Oc3eiwbo0p4vArLqFuNKdYKLF7mhtNZ42NS5EPkl4uM";
const my_token = "7883530863:AAEZAn-g8qZT3Lo72zgb5ph3ZMyZdmfVtMM";
// ==========================================

if (!my_url || my_url.includes("your-project-id")) {
    console.error("❌ ERROR: You forgot to paste your actual Supabase URL!");
}

const supabase = createClient(my_url, my_key);
const bot = new Telegraf(my_token);
const app = express();
const PORT = process.env.PORT || 10000;

async function getAccount(userId, username) {
  try {
    let { data, error } = await supabase.from('users').select('*').eq('user_id', userId).single();
    if (!data) {
      const { data: newUser } = await supabase.from('users').insert([{ user_id: userId, username: username || 'unknown', balance: 1000 }]).select().single();
      return newUser;
    }
    return data;
  } catch (e) { console.log("DB Check:", e); return null; }
}

async function updateBal(userId, newBal) {
  await supabase.from('users').update({ balance: newBal }).eq('user_id', userId);
}

app.get('/', (req, res) => res.send('VAULT ONLINE'));

bot.start(async (ctx) => {
  const user = await getAccount(ctx.from.id, ctx.from.username);
  ctx.reply(`🔪 PIT OPEN.\n💰 Balance: ${user ? user.balance : 1000} K-Credits`);
});

bot.command('roll', async (ctx) => {
  const user = await getAccount(ctx.from.id, ctx.from.username);
  const bet = parseInt(ctx.message.text.split(' ')[1]);
  if (!bet || bet <= 0 || (user && user.balance < bet)) return ctx.reply("❌ Invalid bet.");

  let currentBal = user.balance - bet;
  await updateBal(ctx.from.id, currentBal);

  ctx.replyWithDice().then((msg) => {
    setTimeout(async () => {
      if (msg.dice.value >= 4) {
        currentBal += (bet * 2);
        await updateBal(ctx.from.id, currentBal);
        ctx.reply(`✅ WIN! Balance: ${currentBal}`);
      } else {
        ctx.reply(`💀 LOSS. Balance: ${currentBal}`);
      }
    }, 3500);
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Web Server on ${PORT}`);
  bot.launch().catch(err => console.error("Bot Launch Error:", err));
});
