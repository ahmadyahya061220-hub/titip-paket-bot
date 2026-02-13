/**
 * Bot Titip Paket Node.js - Final Version
 * Anti-crash, PM2-friendly, handle semua error
 */

const { Telegraf, Markup } = require('telegraf');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// ====== CONFIG ======
const BOT_TOKEN = process.env.BOT_TOKEN;
const EMAIL_ADDRESS = process.env.EMAIL_ADDRESS;
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;
const MAX_RETRY = 3;
const RETRY_DELAY = 2000; // ms
const RIWAYAT_FILE = path.join(__dirname, 'riwayat.json');

if (!BOT_TOKEN || !EMAIL_ADDRESS || !EMAIL_PASSWORD) {
  console.error("⚠ Pastikan environment variables BOT_TOKEN, EMAIL_ADDRESS, EMAIL_PASSWORD sudah diatur!");
  process.exit(1);
}

// ====== INIT BOT ======
const bot = new Telegraf(BOT_TOKEN);

// ====== GLOBAL SESSION ======
const sessions = {}; // simpan session per chat untuk input paket

// ====== EMAIL FUNCTION ======
async function sendEmail(to, subject, text) {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: EMAIL_ADDRESS, pass: EMAIL_PASSWORD },
    });

    let success = false;
    for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
      try {
        await transporter.sendMail({ from: EMAIL_ADDRESS, to, subject, text });
        success = true;
        break;
      } catch (e) {
        console.error(`Percobaan ${attempt} kirim email gagal:`, e.message);
        await new Promise(res => setTimeout(res, RETRY_DELAY));
      }
    }
    return success;
  } catch (err) {
    console.error("Error email function:", err.message);
    return false;
  }
}

// ====== HELPERS ======
function generateResi() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let resi = '';
  for (let i = 0; i < 10; i++) resi += chars.charAt(Math.floor(Math.random() * chars.length));
  return resi;
}

function logPackage(packageData) {
  try {
    let riwayat = [];
    if (fs.existsSync(RIWAYAT_FILE)) {
      const content = fs.readFileSync(RIWAYAT_FILE, 'utf-8');
      riwayat = content ? JSON.parse(content) : [];
    }
    riwayat.push(packageData);
    fs.writeFileSync(RIWAYAT_FILE, JSON.stringify(riwayat, null, 2));
  } catch (e) {
    console.error("Error saat menyimpan riwayat:", e.message);
  }
}

// ====== START COMMAND ======
bot.start(async (ctx) => {
  try {
    sessions[ctx.chat.id] = {};
    await ctx.reply("Selamat datang di Bot Titip Paket 🛒", Markup.inlineKeyboard([
      [Markup.button.callback('📦 Titip Paket', 'titip')],
      [Markup.button.callback('📄 Riwayat Paket', 'riwayat')],
      [Markup.button.callback('ℹ️ Info Layanan', 'info')]
    ]));
  } catch (e) {
    console.error("Error start command:", e.message);
  }
});

// ====== MENU ACTION ======
bot.action(/.*/, async (ctx) => {
  try {
    const action = ctx.callbackQuery.data;
    sessions[ctx.chat.id] = sessions[ctx.chat.id] || {};

    if (action === 'titip') {
      await ctx.reply("Silakan masukkan data paket dengan format:\nBerat(kg);Panjang(cm);Lebar(cm);Tinggi(cm);Alamat Tujuan");
      sessions[ctx.chat.id].step = 'input_package';
    } else if (action === 'riwayat') {
      let msg = "Belum ada paket.";
      try {
        if (fs.existsSync(RIWAYAT_FILE)) {
          const riwayat = JSON.parse(fs.readFileSync(RIWAYAT_FILE));
          if (riwayat.length > 0) {
            msg = "📄 Riwayat Paket (10 terakhir):\n";
            riwayat.slice(-10).forEach(p => {
              msg += `Resi: ${p.resi} | ${p.berat}kg | ${p.dims} | ${p.alamat}\n`;
            });
          }
        }
      } catch (e) {
        console.error("Error membaca riwayat:", e.message);
        msg = "⚠ Gagal membaca riwayat paket.";
      }
      await ctx.reply(msg);
    } else if (action === 'info') {
      await ctx.reply("Layanan titip paket:\n- Berat maksimal 50kg\n- Gratis ongkir di kota tertentu\n- Paket di-tracking realtime");
    }
    await ctx.answerCbQuery();
  } catch (e) {
    console.error("Error menu action:", e.message);
  }
});

// ====== INPUT PACKAGE ======
bot.on('text', async (ctx) => {
  try {
    sessions[ctx.chat.id] = sessions[ctx.chat.id] || {};
    if (sessions[ctx.chat.id].step !== 'input_package') return;

    const text = ctx.message.text;
    const parts = text.split(';').map(x => x.trim());
    if (parts.length !== 5) {
      await ctx.reply("Format salah! Gunakan titik koma (;) seperti contoh.");
      return;
    }

    const [berat, panjang, lebar, tinggi, alamat] = parts;
    const dims = `${panjang}x${lebar}x${tinggi}`;
    const resi = generateResi();
    const packageData = { resi, berat, dims, alamat };

    logPackage(packageData);

    const subject = `Paket Baru - Resi ${resi}`;
    const body = `Paket baru telah dibuat:\nResi: ${resi}\nBerat: ${berat}kg\nDimensi: ${dims}\nAlamat: ${alamat}`;
    const emailSuccess = await sendEmail(EMAIL_ADDRESS, subject, body);

    await ctx.reply(`✅ Paket berhasil dibuat!\nNomor Resi: ${resi}\nEmail notifikasi ${emailSuccess ? 'terkirim ✅' : 'gagal ❌'}`);

    sessions[ctx.chat.id].step = null;
  } catch (e) {
    console.error("Error input package:", e.message);
    await ctx.reply("⚠ Terjadi kesalahan saat memproses paket. Coba lagi.");
  }
});

// ====== GLOBAL ERROR HANDLER ======
bot.catch((err, ctx) => {
  console.error(`Terjadi error global: ${err.message}`);
});

// ====== PROCESS LEVEL ERROR HANDLING ======
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err.message);
});

// ====== LAUNCH BOT ======
bot.launch().then(() => console.log("Bot Titip Paket berjalan... ✅"));

// ====== GRACEFUL STOP ======
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
