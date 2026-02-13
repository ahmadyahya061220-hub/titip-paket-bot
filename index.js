const { Telegraf, Markup } = require('telegraf');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const BOT_TOKEN = process.env.BOT_TOKEN;
const EMAIL_ADDRESS = process.env.EMAIL_ADDRESS;
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;
const MAX_RETRY = 3;
const RETRY_DELAY = 2000;
const RIWAYAT_FILE = path.join(__dirname, 'riwayat.json');

if (!BOT_TOKEN || !EMAIL_ADDRESS || !EMAIL_PASSWORD) {
  console.error("⚠ Environment variables BOT_TOKEN, EMAIL_ADDRESS, EMAIL_PASSWORD harus di-set!");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const sessions = {}; // untuk session per chat

// ====== Email Helper ======
async function sendEmail(to, subject, text) {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: EMAIL_ADDRESS, pass: EMAIL_PASSWORD }
    });

    for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
      try {
        await transporter.sendMail({ from: EMAIL_ADDRESS, to, subject, text });
        return true;
      } catch (e) {
        console.error(`Attempt ${attempt} kirim email gagal: ${e.message}`);
        await new Promise(res => setTimeout(res, RETRY_DELAY));
      }
    }
    return false;
  } catch (err) {
    console.error("Error global email:", err.message);
    return false;
  }
}

// ====== Helpers ======
function generateResi() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 10 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
}

function logPackage(data) {
  try {
    if (!fs.existsSync(RIWAYAT_FILE)) fs.writeFileSync(RIWAYAT_FILE, "[]");
    const content = fs.readFileSync(RIWAYAT_FILE, 'utf-8') || "[]";
    const riwayat = JSON.parse(content);
    riwayat.push(data);
    fs.writeFileSync(RIWAYAT_FILE, JSON.stringify(riwayat, null, 2));
  } catch (e) {
    console.error("Error logPackage:", e.message);
  }
}

// ====== Start Command ======
bot.start(async (ctx) => {
  try {
    sessions[ctx.chat.id] = {};
    await ctx.reply("Selamat datang di Bot Titip Paket 🛒", Markup.inlineKeyboard([
      [Markup.button.callback('📦 Titip Paket', 'titip')],
      [Markup.button.callback('📄 Riwayat Paket', 'riwayat')],
      [Markup.button.callback('ℹ️ Info Layanan', 'info')]
    ]));
  } catch (e) { console.error("Error start:", e.message); }
});

// ====== Menu Handler ======
bot.action(/.*/, async (ctx) => {
  try {
    const action = ctx.callbackQuery.data;
    sessions[ctx.chat.id] = sessions[ctx.chat.id] || {};

    if (action === 'titip') {
      await ctx.reply("Masukkan paket: Berat(kg);Panjang;Lebar;Tinggi;Alamat");
      sessions[ctx.chat.id].step = 'input_package';
    } else if (action === 'riwayat') {
      try {
        if (!fs.existsSync(RIWAYAT_FILE)) { await ctx.reply("Belum ada paket."); return; }
        const riwayat = JSON.parse(fs.readFileSync(RIWAYAT_FILE));
        if (riwayat.length === 0) { await ctx.reply("Belum ada paket."); return; }
        let msg = "📄 Riwayat Paket (10 terakhir):\n";
        riwayat.slice(-10).forEach(p => { msg += `Resi: ${p.resi} | ${p.berat}kg | ${p.dims} | ${p.alamat}\n`; });
        await ctx.reply(msg);
      } catch (e) { await ctx.reply("⚠ Gagal membaca riwayat"); console.error(e.message); }
    } else if (action === 'info') {
      await ctx.reply("Layanan:\n- Berat max 50kg\n- Gratis ongkir tertentu\n- Tracking realtime");
    }
    await ctx.answerCbQuery();
  } catch (e) { console.error("Error menu action:", e.message); }
});

// ====== Input Package Handler ======
bot.on('text', async (ctx) => {
  try {
    sessions[ctx.chat.id] = sessions[ctx.chat.id] || {};
    if (sessions[ctx.chat.id].step !== 'input_package') return;

    const text = ctx.message.text;
    const parts = text.split(';').map(x => x.trim());
    if (parts.length !== 5) { await ctx.reply("Format salah! Gunakan ;"); return; }

    const [berat, panjang, lebar, tinggi, alamat] = parts;
    const dims = `${panjang}x${lebar}x${tinggi}`;
    const resi = generateResi();
    const packageData = { resi, berat, dims, alamat };

    logPackage(packageData);

    const subject = `Paket Baru - Resi ${resi}`;
    const body = `Paket baru:\nResi: ${resi}\nBerat: ${berat}kg\nDimensi: ${dims}\nAlamat: ${alamat}`;
    const emailSuccess = await sendEmail(EMAIL_ADDRESS, subject, body);

    await ctx.reply(`✅ Paket berhasil dibuat!\nResi: ${resi}\nEmail ${emailSuccess ? "terkirim ✅" : "gagal ❌"}`);
    sessions[ctx.chat.id].step = null;
  } catch (e) {
    console.error("Error input package:", e.message);
    await ctx.reply("⚠ Terjadi kesalahan saat memproses paket.");
  }
});

// ====== Global Error ======
bot.catch((err) => console.error("Bot global error:", err.message));

process.on('unhandledRejection', (reason) => console.error("Unhandled Rejection:", reason));
process.on('uncaughtException', (err) => console.error("Uncaught Exception:", err.message));

// ====== Launch Bot ======
bot.launch().then(() => console.log("Bot Titip Paket berjalan ✅"));

// ====== Graceful Stop ======
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
