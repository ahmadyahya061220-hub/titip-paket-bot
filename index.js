const { Telegraf, Markup } = require('telegraf');
const nodemailer = require('nodemailer');
const fs = require('fs');

// ====== CONFIG ======
const BOT_TOKEN = process.env.BOT_TOKEN;
const EMAIL_ADDRESS = process.env.EMAIL_ADDRESS;
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;
const MAX_RETRY = 3;
const RETRY_DELAY = 2000; // ms

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
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: EMAIL_ADDRESS,
      pass: EMAIL_PASSWORD,
    },
  });

  let success = false;
  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    try {
      await transporter.sendMail({
        from: EMAIL_ADDRESS,
        to: to,
        subject: subject,
        text: text,
      });
      success = true;
      break;
    } catch (e) {
      console.log(`Percobaan ${attempt} gagal: ${e}`);
      await new Promise(res => setTimeout(res, RETRY_DELAY));
    }
  }
  return success;
}

// ====== HELPERS ======
function generateResi() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let resi = '';
  for (let i = 0; i < 10; i++) {
    resi += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return resi;
}

function logPackage(packageData) {
  let riwayat = [];
  try {
    if (fs.existsSync('riwayat.json')) {
      riwayat = JSON.parse(fs.readFileSync('riwayat.json'));
    }
    riwayat.push(packageData);
    fs.writeFileSync('riwayat.json', JSON.stringify(riwayat, null, 2));
  } catch (e) {
    console.error("Error saat menyimpan riwayat:", e);
  }
}

// ====== MENU BOT ======
bot.start(async (ctx) => {
  try {
    sessions[ctx.chat.id] = {};
    await ctx.reply("Selamat datang di Bot Titip Paket 🛒", Markup.inlineKeyboard([
      [Markup.button.callback('📦 Titip Paket', 'titip')],
      [Markup.button.callback('📄 Riwayat Paket', 'riwayat')],
      [Markup.button.callback('ℹ️ Info Layanan', 'info')]
    ]));
  } catch (e) {
    console.error("Error start command:", e);
  }
});

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
        if (fs.existsSync('riwayat.json')) {
          const riwayat = JSON.parse(fs.readFileSync('riwayat.json'));
          msg = "📄 Riwayat Paket:\n";
          riwayat.slice(-10).forEach(p => {
            msg += `Resi: ${p.resi} | ${p.berat}kg | ${p.dims} | ${p.alamat}\n`;
          });
        }
      } catch (e) {
        console.error("Error membaca riwayat:", e);
      }
      await ctx.reply(msg);
    }
