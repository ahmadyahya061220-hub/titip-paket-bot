require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const nodemailer = require("nodemailer");

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const app = express();

app.get("/", (req, res) => {
  res.send("Bot Titip Paket Aktif 🚀");
});

app.listen(process.env.PORT || 3000);

// ================= DATABASE SEDERHANA =================
let users = {};
let emailState = {};
const OTP_EXPIRE = 5 * 60 * 1000;

// ================= MENU UTAMA =================
function mainMenu() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📦 Titip Paket", callback_data: "titip" }],
        [{ text: "💰 Cek Tarif", callback_data: "tarif" }],
        [{ text: "✉ Aktivasi Email", callback_data: "aktivasi" }],
        [{ text: "💳 Cek Saldo", callback_data: "saldo" }]
      ]
    }
  };
}

// ================= START =================
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  if (!users[chatId]) {
    users[chatId] = {
      saldo: 50000,
      verified: false
    };
  }

  bot.sendMessage(
    chatId,
    `🚀 *Selamat Datang di Bot Titip Paket*

Layanan profesional untuk pengiriman barang Anda.`,
    { parse_mode: "Markdown", ...mainMenu() }
  );
});

// ================= CALLBACK =================
bot.on("callback_query", async (query) => {

  const chatId = query.message.chat.id;
  const data = query.data;

  if (!users[chatId]) {
    users[chatId] = { saldo: 50000, verified: false };
  }

  // ===== TITIP PAKET =====
  if (data === "titip") {
    if (!users[chatId].verified) {
      return bot.sendMessage(chatId, "❌ Aktivasi email terlebih dahulu.");
    }

    bot.sendMessage(
      chatId,
      `📦 *Titip Paket*

Silakan kirim format berikut:

Nama:
Alamat Tujuan:
Berat (kg):`,
      { parse_mode: "Markdown" }
    );
  }

  // ===== CEK TARIF =====
  if (data === "tarif") {
    bot.sendMessage(
      chatId,
      `💰 *Daftar Tarif*

1 kg = Rp10.000
2 kg = Rp18.000
3 kg = Rp25.000
> 5 kg diskon khusus`,
      { parse_mode: "Markdown" }
    );
  }

  // ===== SALDO =====
  if (data === "saldo") {
    bot.sendMessage(
      chatId,
      `💳 Saldo Anda: Rp${users[chatId].saldo}`
    );
  }

  // ===== AKTIVASI EMAIL =====
  if (data === "aktivasi") {
    emailState[chatId] = { step: "input_email" };
    bot.sendMessage(chatId, "📧 Masukkan email Anda:");
  }

  bot.answerCallbackQuery(query.id);
});

// ================= MESSAGE HANDLER =================
bot.on("message", async (msg) => {

  const chatId = msg.chat.id;
  const text = msg.text;

  if (!text) return;

  // ===== INPUT EMAIL =====
  if (emailState[chatId]?.step === "input_email") {

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(text)) {
      return bot.sendMessage(chatId, "❌ Format email tidak valid.");
    }

    const code = Math.floor(100000 + Math.random() * 900000);
    const expireTime = Date.now() + OTP_EXPIRE;

    emailState[chatId] = {
      step: "verify",
      email: text,
      code,
      expire: expireTime
    };

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
        subject: "Kode OTP Titip Paket",
        text: `Kode OTP Anda: ${code}\nBerlaku 5 menit.`
      });

      bot.sendMessage(chatId, "✅ OTP dikirim. Masukkan kode:");

    } catch (err) {
      console.log(err);
      delete emailState[chatId];
      bot.sendMessage(chatId, "❌ Gagal kirim email.");
    }

    return;
  }

  // ===== VERIFIKASI OTP =====
  if (emailState[chatId]?.step === "verify") {

    if (Date.now() > emailState[chatId].expire) {
      delete emailState[chatId];
      return bot.sendMessage(chatId, "⏰ OTP kadaluarsa. Aktivasi ulang.");
    }

    if (text == emailState[chatId].code) {
      users[chatId].verified = true;
      delete emailState[chatId];

      return bot.sendMessage(
        chatId,
        "🎉 Email berhasil diverifikasi!",
        mainMenu()
      );
    } else {
      return bot.sendMessage(chatId, "❌ OTP salah.");
    }
  }

});
