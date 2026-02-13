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
  if (fs.existsSync('riwayat.json')) {
    riwayat = JSON.parse(fs.readFileSync('riwayat.json'));
  }
  riwayat.push(packageData);
  fs.writeFileSync('riwayat.json', JSON.stringify(riwayat, null, 2));
}

// ====== MENU BOT ======
bot.start((ctx) => {
  ctx.reply("Selamat datang di Bot Titip Paket 🛒", Markup.inlineKeyboard([
    [Markup.button.callback('📦 Titip Paket', 'titip')],
    [Markup.button.callback('📄 Riwayat Paket', 'riwayat')],
    [Markup.button.callback('ℹ️ Info Layanan', 'info')]
  ]));
});

bot.action('titip', (ctx) => {
  ctx.reply("Silakan masukkan data paket dengan format:\nBerat(kg);Panjang(cm);Lebar(cm);Tinggi(cm);Alamat Tujuan");
  ctx.session = { step: 'input_package' };
});

bot.action('riwayat', (ctx) => {
  if (fs.existsSync('riwayat.json')) {
    const riwayat = JSON.parse(fs.readFileSync('riwayat.json'));
    let msg = "📄 Riwayat Paket:\n";
    riwayat.slice(-10).forEach(p => {
      msg += `Resi: ${p.resi} | ${p.berat}kg | ${p.dims} | ${p.alamat}\n`;
    });
    ctx.reply(msg);
  } else {
    ctx.reply("Belum ada paket yang dibuat.");
  }
});

bot.action('info', (ctx) => {
  ctx.reply("Layanan titip paket:\n- Berat maksimal 50kg\n- Gratis ongkir di kota tertentu\n- Paket di-tracking realtime");
});

// ====== INPUT PACKAGE ======
bot.on('text', async (ctx) => {
  if (!ctx.session || ctx.session.step !== 'input_package') return;

  const text = ctx.message.text;
  const parts = text.split(';').map(x => x.trim());
  if (parts.length !== 5) {
    ctx.reply("Format salah! Gunakan titik koma (;) seperti contoh.");
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

  ctx.reply(`✅ Paket berhasil dibuat!\nNomor Resi: ${resi}\nEmail notifikasi ${emailSuccess ? 'terkirim ✅' : 'gagal ❌'}`);

  ctx.session.step = null;
});

// ====== ERROR HANDLER ======
bot.catch((err, ctx) => {
  console.error(`Terjadi error: ${err}`);
});

// ====== LAUNCH BOT ======
bot.launch();
console.log("Bot Titip Paket berjalan... ✅");

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
