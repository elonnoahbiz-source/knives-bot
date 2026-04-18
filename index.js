const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

// --- CONFIGURATION ---
const SB_URL = "https://dptjeumndtrgfaxtlwim.supabase.co/"; 
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwdGpldW1uZHRyZ2ZheHRsd2ltIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQ0NTk5MiwiZXhwIjoyMDkyMDIxOTkyfQ.Oc3eiwbo0p4vArLqFuNKdYKLF7mhtNZ42NS5EPkl4uM";
const TG_TOKEN = "7883530863:AAFcepq9EGYbKIv1nXx8FxIVkFKUtxlZ5aw";
const OWNER_ID = 6542642909; // <-- REPLACE WITH YOUR ACTUAL TELEGRAM ID

const WALLETS = {
    LTC: "ltc1qxwsyq6lwv3334qduv0vu8j966gjrvcdkrasrj0",
    SOL: "CiXyCMtPZoMX46DoWXu8qqkcFWSdUUhkUAHQhLMbz61x",
    BTC: "bc1q48a6wvxjwy5ays4gd4asn4lp869khpr9uyve0t"
};

const supabase = createClient(SB_URL, SB_KEY);
const bot = new Telegraf(TG_TOKEN);
const app = express();

// --- DATABASE HELPERS ---
async function getAccount(userId, username) {
    let { data } = await supabase.from('users').select('*').eq('user_id', userId).single();
    if (!data) {
        const { data: newUser } = await supabase.from('users').insert([{ 
            user_id: userId, username: username || 'anon', balance: 0, total_deposited: 0, bets_placed: 0 
        }]).select().single();
        return newUser;
    }
    return data;
}

// --- WELCOME PAGE ---
bot.start(async (ctx) => {
    const user = await getAccount(ctx.from.id, ctx.from.username);
    const welcomeMsg = `🔪 *WELCOME TO KNIVES CASINO* 🔪\n\n` +
        `💰 *Wallet:* $${user.balance.toFixed(2)}\n` +
        `🎰 *Status:* Verified No-KYC\n\n` +
        `*COMMANDS:*\n` +
        `🎮 /flip - Coinflip (High Odds)\n` +
        `🚀 /crash - Multiplier Greed Trap\n` +
        `📥 /deposit - Add Liquidity (Min $5)\n` +
        `📤 /withdraw - Cash Out\n` +
        `ℹ️ /help - Support`;
    
    ctx.replyWithMarkdown(welcomeMsg);
});

// --- DEPOSIT SYSTEM ---
bot.command('deposit', (ctx) => {
    ctx.reply(`📥 *SELECT DEPOSIT METHOD (MIN $5)*`, Markup.inlineKeyboard([
        [Markup.button.callback('Litecoin (LTC)', 'dep_LTC')],
        [Markup.button.callback('Solana (SOL)', 'dep_SOL')],
        [Markup.button.callback('Bitcoin (BTC)', 'dep_BTC')]
    ]));
});

// Handle Wallet Selection
bot.action(/dep_(.*)/, (ctx) => {
    const method = ctx.match[1];
    const addr = WALLETS[method];
    ctx.replyWithMarkdown(`⚠️ *SEND AT LEAST $5 USD IN ${method}*\n\nAddress:\n\`${addr}\`\n\n*AFTER SENDING:* Reply to this message with your Transaction Hash (TXID) so I can verify the funds.`);
});

// Capture TX Hash and send to Owner
bot.on('text', async (ctx) => {
    if (ctx.message.text.length > 30 && !ctx.message.text.startsWith('/')) {
        const txHash = ctx.message.text;
        ctx.reply("⌛ *HASH RECEIVED.* Owner is verifying... Your balance will update shortly.");
        
        // Notify the Owner (YOU)
        bot.telegram.sendMessage(OWNER_ID, 
            `🔔 *NEW DEPOSIT CLAIM*\n\nUser: @${ctx.from.username} (${ctx.from.id})\nHash: \`${txHash}\` \n\nApprove $5?`, 
            Markup.inlineKeyboard([
                [Markup.button.callback('✅ Confirm $5', `approve_${ctx.from.id}_5`)],
                [Markup.button.callback('✅ Confirm $10', `approve_${ctx.from.id}_10`)],
                [Markup.button.callback('❌ Reject', `reject_${ctx.from.id}`)]
            ])
        );
    }
});

// Owner Approval Logic
bot.action(/approve_(\d+)_(\d+)/, async (ctx) => {
    const [_, userId, amount] = ctx.match;
    const user = await getAccount(userId);
    const newBal = user.balance + parseInt(amount);
    
    await supabase.from('users').update({ 
        balance: newBal, 
        total_deposited: user.total_deposited + parseInt(amount) 
    }).eq('user_id', userId);

    bot.telegram.sendMessage(userId, `✅ *DEPOSIT CONFIRMED!*\n$${amount} added to your wallet. Good luck.`);
    ctx.editMessageText(`✅ Approved $${amount} for ${userId}`);
});

// --- GAME: FLIP (With Tutorial) ---
bot.command('flip', async (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
        return ctx.reply("📖 *HOW TO PLAY FLIP:*\nType `/flip [amount]`. It's a 50/50 heads or tails. Double your money or lose it all. House edge: 4%.");
    }
    const bet = parseFloat(args[1]);
    const user = await getAccount(ctx.from.id, ctx.from.username);

    if (bet < 1 || user.balance < bet) return ctx.reply("❌ Low balance or invalid bet.");

    // House edge: 52% chance to lose
    const win = Math.random() > 0.52;
    const newBal = win ? user.balance + bet : user.balance - bet;
    
    await supabase.from('users').update({ balance: newBal, bets_placed: user.bets_placed + 1 }).eq('user_id', ctx.from.id);
    
    ctx.reply(win ? `🪙 *HEADS!* You won $${bet * 2}!` : `🪙 *TAILS.* Rekt.`);
});

// --- WITHDRAWAL (The Trap) ---
bot.command('withdraw', async (ctx) => {
    const user = await getAccount(ctx.from.id, ctx.from.username);
    const minWithdraw = user.total_deposited * 2;

    if (user.bets_placed < 2) {
        return ctx.reply("⚠️ *SECURITY CHECK:* You must place at least 2 bets before your first withdrawal to verify 'human' activity.");
    }

    if (user.balance < minWithdraw || user.balance < 10) {
        return ctx.reply(`❌ *WITHDRAWAL DENIED*\n\nMinimum Withdrawal for your account: *$${minWithdraw}*\n(Requirement: 2x your total deposits).`);
    }

    ctx.reply(`✅ *ELIGIBLE FOR WITHDRAWAL*\nSend your address to the owner @YOUR_USERNAME to process.`);
});

// Server boot
app.get('/', (req, res) => res.send('KNIVES CASINO ONLINE'));
app.listen(process.env.PORT || 10000, '0.0.0.0', () => {
    bot.telegram.deleteWebhook().then(() => bot.launch());
});
