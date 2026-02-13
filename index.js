console.log("TOKEN:", process.env.BOT_TOKEN);

const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const nodemailer = require('nodemailer');

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

const app = express();
app.get("/", (req, res) => {
  res.send("Bot Aktif ✅");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});

// Anti crash
process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);

let userData = {};
let emailCodes = {};

// ================= MENU =================
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(chatId, "Selamat datang di Bot Titip Paket 📦", {
    reply_markup: {
      keyboard: [
        ["📦 Titip Paket"],
        ["✉ Aktivasi Email"]
      ],
      resize_keyboard: true
    }
  });
});

// ================= TITIP PAKET =================
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (text === "📦 Titip Paket") {
    userData[chatId] = {};
    bot.sendMessage(chatId, "Masukkan Nama Pengirim:");
  }

  else if (userData[chatId] && !userData[chatId].pengirim) {
    userData[chatId].pengirim = text;
    bot.sendMessage(chatId, "Masukkan Nama Penerima:");
  }

  else if (userData[chatId] && !userData[chatId].penerima) {
    userData[chatId].penerima = text;

    const transaksiId = "TRX" + Date.now();
    const resi = "RESI" + Math.floor(Math.random() * 1000000000);

    bot.sendMessage(chatId,
`📦 DETAIL PAKET

Pengirim: ${userData[chatId].pengirim}
Penerima: ${userData[chatId].penerima}

Berat: 1 kg
Panjang: 10
Lebar: 10
Tinggi: 10

Total: Rp 3.500

✅ ID Transaksi: ${transaksiId}
🎫 Nomor Resi: ${resi}`
    );

    delete userData[chatId];
  }

  // ================= AKTIVASI EMAIL =================
  else if (text === "✉ Aktivasi Email") {
    bot.sendMessage(chatId, "Masukkan email Anda:");
    emailCodes[chatId] = {};
  }

  else if (emailCodes[chatId] && !emailCodes[chatId].email) {
  emailCodes[chatId].email = text;
  const code = Math.floor(100000 + Math.random() * 900000);
  emailCodes[chatId].code = code;

  try {

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: text,
      subject: "Kode Aktivasi",
      text: "Kode verifikasi Anda: " + code
    });

    console.log("Email berhasil dikirim");
    bot.sendMessage(chatId, "✅ Kode aktivasi sudah dikirim. Masukkan kode:");

  } catch (error) {
    console.error("ERROR EMAIL:", error);
    bot.sendMessage(chatId, "❌ Gagal kirim email. Cek konfigurasi.");
  }
}
