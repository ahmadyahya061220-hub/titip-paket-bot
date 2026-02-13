const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const nodemailer = require('nodemailer');

const token = process.env.BOT_TOKEN;

if (!token) {
  console.error("BOT_TOKEN tidak ditemukan!");
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Bot Online ✅");
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});

// ANTI CRASH GLOBAL
process.on("unhandledRejection", (err) => {
  console.error("UnhandledRejection:", err);
});
process.on("uncaughtException", (err) => {
  console.error("UncaughtException:", err);
});

console.log("Bot siap menerima pesan...");

// ================== DATABASE SEMENTARA ==================
let userState = {};
let emailData = {};

// ================== START ==================
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

// ================== MESSAGE HANDLER ==================
bot.on("message", async (msg) => {

  const chatId = msg.chat.id;
  const text = msg.text;

  console.log("Pesan masuk:", text);

  if (!text) return;

  // ================= TITIP PAKET =================
  if (text === "📦 Titip Paket") {
    userState[chatId] = { step: "pengirim" };
    return bot.sendMessage(chatId, "Masukkan Nama Pengirim:");
  }

  if (userState[chatId]?.step === "pengirim") {
    userState[chatId].pengirim = text;
    userState[chatId].step = "penerima";
    return bot.sendMessage(chatId, "Masukkan Nama Penerima:");
  }

  if (userState[chatId]?.step === "penerima") {
    userState[chatId].penerima = text;

    const transaksiId = "TRX" + Date.now();
    const resi = "RESI" + Math.floor(Math.random() * 1000000000);

    await bot.sendMessage(chatId,
`📦 DETAIL PAKET

Pengirim: ${userState[chatId].pengirim}
Penerima: ${userState[chatId].penerima}

Berat: 1 kg
Panjang: 10
Lebar: 10
Tinggi: 10

Total: Rp 3.500

✅ ID Transaksi: ${transaksiId}
🎫 Nomor Resi: ${resi}`
    );

    delete userState[chatId];
    return;
  }

  // ================= AKTIVASI EMAIL =================
  if (text === "✉ Aktivasi Email") {
    emailData[chatId] = { step: "input_email" };
    return bot.sendMessage(chatId, "Masukkan email Anda:");
  }

  if (emailData[chatId]?.step === "input_email") {

    const email = text;
    const code = Math.floor(100000 + Math.random() * 900000);

    emailData[chatId].email = email;
    emailData[chatId].code = code;
    emailData[chatId].step = "verifikasi";

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
        to: email,
        subject: "Kode Aktivasi",
        text: "Kode verifikasi Anda: " + code
      });

      console.log("Email berhasil dikirim");
      return bot.sendMessage(chatId, "✅ Kode sudah dikirim. Masukkan kode:");

    } catch (err) {
      console.error("ERROR EMAIL:", err);
      delete emailData[chatId];
      return bot.sendMessage(chatId, "❌ Gagal kirim email. Cek konfigurasi EMAIL_USER & EMAIL_PASS.");
    }
  }

  if (emailData[chatId]?.step === "verifikasi") {
    if (text == emailData[chatId].code) {
      delete emailData[chatId];
      return bot.sendMessage(chatId, "✅ Email berhasil diverifikasi!");
    } else {
      return bot.sendMessage(chatId, "❌ Kode salah. Coba lagi.");
    }
  }

});
