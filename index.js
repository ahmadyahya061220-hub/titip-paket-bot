require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const nodemailer = require("nodemailer");
const express = require("express");

const app = express();
app.get("/", (req, res) => res.send("Bot Running ✅"));

app.listen(process.env.PORT || 3000, () => {
  console.log("Server running...");
});

if (!process.env.BOT_TOKEN) {
  console.log("BOT_TOKEN tidak ditemukan di .env");
  process.exit(1);
}

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

process.on("uncaughtException", function (err) {
  console.log("CRASH ERROR:", err);
});

const users = {};
const emailStep = {};

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(chatId, "🤖 *BOT TITIP PAKET USAHA*\n\nSilakan pilih menu:", {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "📦 Titip Paket", callback_data: "titip" }],
        [{ text: "💰 Cek Tarif", callback_data: "tarif" }],
        [{ text: "✉ Aktivasi Email", callback_data: "aktivasi" }],
        [{ text: "👤 Status Akun", callback_data: "status" }],
      ],
    },
  });
});

bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (data === "aktivasi") {
    emailStep[chatId] = "email";
    bot.sendMessage(chatId, "📧 Masukkan email Anda:");
  }

  if (data === "status") {
    if (users[chatId]?.verified) {
      bot.sendMessage(chatId, "✅ Email sudah terverifikasi");
    } else {
      bot.sendMessage(chatId, "❌ Email belum terverifikasi");
    }
  }

  if (data === "titip") {
    if (!users[chatId]?.verified) {
      return bot.sendMessage(chatId, "⚠ Aktivasi email terlebih dahulu!");
    }

    bot.sendMessage(chatId,
      "📦 *DATA TITIP PAKET*\n\n" +
      "Berat: 1kg\n" +
      "Panjang: 10cm\n" +
      "Lebar: 10cm\n" +
      "Tinggi: 10cm\n\n" +
      "✅ Resi berhasil dibuat:\n" +
      "IDP" + Math.floor(Math.random() * 999999),
      { parse_mode: "Markdown" }
    );
  }

  if (data === "tarif") {
    bot.sendMessage(chatId,
      "💰 *Estimasi Tarif*\n\n" +
      "1kg: Rp 15.000\n" +
      "2kg: Rp 25.000\n" +
      "3kg: Rp 35.000",
      { parse_mode: "Markdown" }
    );
  }
});

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;

  if (!emailStep[chatId]) return;

  if (emailStep[chatId] === "email") {
    const email = msg.text;
    const otp = Math.floor(100000 + Math.random() * 900000);

    users[chatId] = { email, otp, verified: false };

    try {
      await transporter.sendMail({
        from: `"Titip Paket Bot" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Kode OTP Aktivasi",
        text: `Kode OTP Anda adalah: ${otp}`,
      });

      emailStep[chatId] = "otp";
      bot.sendMessage(chatId, "✅ OTP dikirim ke email.\nMasukkan kode OTP:");
    } catch (err) {
      console.log("EMAIL ERROR:", err);
      bot.sendMessage(chatId, "❌ Gagal kirim email. Cek App Password Gmail.");
      delete emailStep[chatId];
    }
  }

  else if (emailStep[chatId] === "otp") {
    if (msg.text == users[chatId].otp) {
      users[chatId].verified = true;
      bot.sendMessage(chatId, "🎉 Email berhasil diverifikasi!");
    } else {
      bot.sendMessage(chatId, "❌ OTP salah.");
    }
    delete emailStep[chatId];
  }
});

console.log("Bot Aktif ✅");
