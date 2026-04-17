const { Telegraf } = require('telegraf');
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

// --- KEYS ---
const SB_URL = "https://dptjeumndtrgfaxtlwim.supabase.co/"; 
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwdGpldW1uZHRyZ2ZheHRsd2ltIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQ0NTk5MiwiZXhwIjoyMDkyMDIxOTkyfQ.Oc3eiwbo0p4vArLqFuNKdYKLF7mhtNZ42NS5EPkl4uM";
const TG_TOKEN = "7883530863:AAEZAn-g8qZT3Lo72zgb5ph3ZMyZdmfVtMM";

const supabase = createClient(SB_URL, SB_KEY);
const bot = new Telegraf(TG_TOKEN);
const app = express();
const PORT = process.env.PORT || 10000;

// 1. FIX THE "CANNOT GET /" ERROR
// This tells Render (and your browser) that the server is healthy
app.get('/', (req, res) => {
  res.status(200).send('LORD CORD CASINO IS LIVE 🎰');
});

// 2. DATABASE HELPER
async function getAccount(userId, username) {
  try {
    let { data } = await supabase.from('users').select('*').eq('user_id', userId).single();
    if (!data) {
      const { data: newUser } = await supabase.from('users').insert([{ 
        user_id: userId, 
        username: username || 'anon', 
        balance: 1000 
      }]).select().single();
      return newUser;
    }
    return data;
  } catch (e) { 
    console.error("DB Error:", e.message);
    return null; 
  }
}

// 3. BOT COMMANDS
bot.start(async (ctx) => {
  const user = await getAccount(ctx.from.id, ctx.from.username);
  ctx.reply(`🔪 WELCOME TO THE PIT\n💰 Wallet: ${user ? user.balance : 1000} K-Credits\n\nCommands:\n/flip [amt]\n/crash [amt]\n/deposit`);
});

bot.command('flip', async (ctx) => {
  const user = await getAccount(ctx.from.id, ctx.from.username);
  const bet = parseInt(ctx.message.text.split(' ')[1]);
  if (!bet || bet <= 0 || !user || user.balance < bet) return ctx.reply("❌ Check your bag.");
  
  const win = Math.random() > 0.52; 
  const newBal = win ? user.balance + bet : user.balance - bet;
  await supabase.from('users').update({ balance: newBal }).eq('user_id', ctx.from.id);
  ctx.reply(win ? `🪙 HEADS! +${bet}. Wallet: ${newBal}` : `🪙 TAILS. Rekt. Wallet: ${newBal}`);
});

// 4. STARTUP SEQUENCE
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Web Server running on port ${PORT}`);
  
  // Launch the bot AFTER the server is up
  bot.launch()
    .then(() => console.log("🚀 Telegram Bot is AWAKE"))
    .catch((err) => console.error("❌ Bot failed to wake up:", err));
});

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
