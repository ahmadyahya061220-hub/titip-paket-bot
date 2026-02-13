require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const app = express();
const PORT = process.env.PORT || 3000;

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// ----- Setup email transporter -----
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

function kirimEmail(to, subject, html) {
  const mailOptions = { from: process.env.EMAIL_USER, to, subject, html };
  transporter.sendMail(mailOptions, (err, info) => {
    if (err) console.error("Gagal kirim email:", err);
  });
}

// ----- Database sementara -----
let users = {};      // { chatId: { step, nama, penerima, berat, total, email, verified } }
let transaksi = [];  // { id, userChatId, data }

// ----- Fungsi bantu -----
function hitungHarga(berat) {
  const hargaPerKg = 10000;
  const profit = 2000;
  return berat * hargaPerKg + profit;
}

function generateResi() {
  return "RESI" + Date.now();
}

// ----- Express server sederhana -----
app.get("/", (req, res) => {
  res.send("Bot Titip Paket Aktif ✅");
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// ----- Bot Telegram -----
// /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  if (!users[chatId]) users[chatId] = { step: 0 };

  const keyboard = [
    ["📧 Aktivasi Email"],
    ["📦 Titip Paket", "ℹ️ Bantuan"],
    ["📊 Status Pesanan"]
  ];

  bot.sendMessage(chatId,
    `📦 *BOT TITIP PAKET*\nPilih menu untuk memulai.`,
    { parse_mode: "Markdown", reply_markup: { keyboard, resize_keyboard: true } }
  );
});

// Handler utama
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();
  if (!text) return;

  if (!users[chatId]) users[chatId] = { step: 0 };
  const user = users[chatId];

  // ----- Menu Aktivasi Email otomatis -----
  if (text === "📧 Aktivasi Email") {
    user.step = "aktivasi_email";
    return bot.sendMessage(chatId, "Masukkan email Anda:");
  }

  if (user.step === "aktivasi_email") {
    const email = text;
    user.email = email;
    user.verified = true;                  // Auto verifikasi
    user.token = crypto.randomBytes(16).toString("hex");
    user.step = 0;
    return bot.sendMessage(chatId,
      `✅ Email ${email} berhasil diverifikasi otomatis!\nSekarang Anda bisa menggunakan menu Titip Paket.`
    );
  }

  // ----- Menu Titip Paket -----
  if (text === "📦 Titip Paket") {
    if (!user.email || !user.verified) {
      return bot.sendMessage(chatId, "❌ Email belum terverifikasi. Silakan aktivasi email dulu.");
    }
    user.step = 1;
    return bot.sendMessage(chatId, "Masukkan Nama Pengirim:");
  }

  // Step 1: Nama Pengirim
  if (user.step === 1) {
    user.nama = text;
    user.step = 2;
    return bot.sendMessage(chatId, "Masukkan Nama Penerima:");
  }

  // Step 2: Nama Penerima
  if (user.step === 2) {
    user.penerima = text;
    user.step = 3;
    return bot.sendMessage(chatId, "Masukkan Berat (kg):");
  }

  // Step 3: Berat
  if (user.step === 3) {
    const berat = parseInt(text);
    if (isNaN(berat) || berat <= 0) return bot.sendMessage(chatId, "Berat tidak valid. Masukkan angka kg.");
    const total = hitungHarga(berat);

    user.berat = berat;
    user.total = total;
    user.step = 4;

    return bot.sendMessage(chatId,
`📦 *KONFIRMASI*

Pengirim: ${user.nama}
Penerima: ${user.penerima}
Berat: ${user.berat} kg
Total Bayar: Rp${user.total}

Silakan transfer ke:
DANA/OVO/BCA XXXXX

Setelah transfer ketik: SUDAH`,
      { parse_mode: "Markdown" }
    );
  }

  // Step 4: Konfirmasi transfer + generate resi
  if (user.step === 4 && text.toUpperCase() === "SUDAH") {
    const idTransaksi = "TRX" + Date.now();
    const nomorResi = generateResi(); // otomatis

    transaksi.push({ id: idTransaksi, userChatId: chatId, data: { ...user, resi: nomorResi } });

    // Kirim pesan ke user di Telegram
    bot.sendMessage(chatId,
`⏳ Pembayaran diterima.
ID Transaksi: ${idTransaksi}
Nomor Resi: ${nomorResi}

Terima kasih 🙏`
    );

    // Notifikasi ke admin
    bot.sendMessage(ADMIN_ID,
`🔔 TRANSAKSI BARU

ID: ${idTransaksi}
User: ${chatId}
Pengirim: ${user.nama}
Penerima: ${user.penerima}
Berat: ${user.berat} kg
Total: Rp${user.total}
Resi: ${nomorResi}`
    );

    // Kirim email notifikasi ke user
    if (user.email) {
      const subject = `Konfirmasi Titip Paket - ID ${idTransaksi}`;
      const html = `
        <h3>Transaksi Anda Berhasil</h3>
        <p>Pengirim: ${user.nama}</p>
        <p>Penerima: ${user.penerima}</p>
        <p>Berat: ${user.berat} kg</p>
        <p>Total Bayar: Rp${user.total}</p>
        <p>Nomor Resi: <b>${nomorResi}</b></p>
        <p>Terima kasih telah menggunakan layanan Titip Paket.</p>
      `;
      kirimEmail(user.email, subject, html);
    }

    user.step = 0;
    return;
  }

  if (user.step === 4) {
    return bot.sendMessage(chatId, "Ketik SUDAH jika sudah transfer.");
  }

  // ----- Menu Status Pesanan -----
  if (text === "📊 Status Pesanan") {
    const userTrx = transaksi.filter(t => t.userChatId === chatId);
    if (!userTrx.length) return bot.sendMessage(chatId, "Belum ada transaksi.");

    let msg = "📊 *Daftar Transaksi Anda*\n\n";
    userTrx.forEach(t => {
      msg += `ID: ${t.id}\nPengirim: ${t.data.nama}\nPenerima: ${t.data.penerima}\nBerat: ${t.data.berat} kg\nTotal: Rp${t.data.total}\nNomor Resi: ${t.data.resi}\n\n`;
    });

    return bot.sendMessage(chatId, msg, { parse_mode: "Markdown" });
  }

  // ----- Menu Bantuan -----
  if (text === "ℹ️ Bantuan") {
    return bot.sendMessage(chatId,
`*Cara pakai:*
1. Aktivasi email lewat 📧 Aktivasi Email.
2. Pilih 📦 Titip Paket.
3. Ikuti instruksi: Nama Pengirim, Nama Penerima, Berat.
4. Transfer sesuai total, lalu ketik SUDAH.
5. Bot otomatis generate nomor resi dan kirim via Telegram & email.
6. Cek status lewat 📊 Status Pesanan.`,
      { parse_mode: "Markdown" }
    );
  }

  // Pesan default
  const keyboard = [
    ["📧 Aktivasi Email"],
    ["📦 Titip Paket", "ℹ️ Bantuan"],
    ["📊 Status Pesanan"]
  ];
  bot.sendMessage(chatId, "Pilih menu:", { reply_markup: { keyboard, resize_keyboard: true } });
});
