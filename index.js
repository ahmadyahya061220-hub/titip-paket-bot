
require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Anti crash basic
process.on("uncaughtException", (err) => {
  console.log("Error:", err.message);
});

process.on("unhandledRejection", (err) => {
  console.log("Unhandled:", err);
});

// Express (buat Railway supaya tidak sleep)
const app = express();
app.get("/", (req, res) => {
  res.send("Bot aktif 🚀");
});
app.listen(process.env.PORT || 3000);

// ================= MENU =================
const menuKeyboard = {
  reply_markup: {
    keyboard: [
      ["💰 Beli limit", "🛢 Cek limit"],
      ["🔄 Convert limit", "🎁 Share limit"],
      ["🎟 Redeem gift code", "👀 Cek NIK"],
      ["⌚ Rekap presensi", "📄 Cek report kbk"],
      ["🔎 Cari barcode", "🔥 Pelaksanaan PJR"],
      ["📚 Listing produk", "🧾 Pembelian banyak"],
      ["🏷 Cek harga", "📢 Planogram"],
      ["🛒 Katalog indomaret"]
    ],
    resize_keyboard: true
  }
};

// ================= START =================
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "🤖 MKR BOT AKTIF\n\nSilakan pilih menu:", menuKeyboard);
});

// ================= COMMAND HANDLER =================

bot.on("message", (msg) => {
  const text = msg.text;
  const chatId = msg.chat.id;

  if (text === "💰 Beli limit") {
    bot.sendMessage(chatId, "Silakan gunakan command /sawer untuk beli limit.");
  }

  if (text === "🛢 Cek limit") {
    bot.sendMessage(chatId, "Limit kamu saat ini: 100");
  }

  if (text === "🔄 Convert limit") {
    bot.sendMessage(chatId, "Gunakan /convert untuk convert limit.");
  }

  if (text === "🎁 Share limit") {
    bot.sendMessage(chatId, "Gunakan /makegiftcode untuk share limit.");
  }

  if (text === "🎟 Redeem gift code") {
    bot.sendMessage(chatId, "Masukkan kode dengan format:\n/giftcode KODE");
  }

  if (text === "👀 Cek NIK") {
    bot.sendMessage(chatId, "Gunakan /ceknik untuk cek NIK.");
  }

  if (text === "⌚ Rekap presensi") {
    bot.sendMessage(chatId, "Gunakan /presensi");
  }

  if (text === "📄 Cek report kbk") {
    bot.sendMessage(chatId, "Gunakan /kbk");
  }

  if (text === "🔎 Cari barcode") {
    bot.sendMessage(chatId, "Gunakan /idm");
  }

  if (text === "🔥 Pelaksanaan PJR") {
    bot.sendMessage(chatId, "Gunakan /pjr");
  }

  if (text === "📚 Listing produk") {
    bot.sendMessage(chatId, "Gunakan /rak");
  }

  if (text === "🧾 Pembelian banyak") {
    bot.sendMessage(chatId, "Gunakan /bulk");
  }

  if (text === "🏷 Cek harga") {
    bot.sendMessage(chatId, "Gunakan /alfa");
  }

  if (text === "📢 Planogram") {
    bot.sendMessage(chatId, "Gunakan /planogram");
  }

  if (text === "🛒 Katalog indomaret") {
    bot.sendMessage(chatId, "Gunakan /katalog");
  }
});

// ================= COMMAND REAL =================

bot.onText(/\/limit/, (msg) => {
  bot.sendMessage(msg.chat.id, "Limit kamu: 100");
});

bot.onText(/\/sawer/, (msg) => {
  bot.sendMessage(msg.chat.id, "Fitur beli limit sedang diproses.");
});

console.log("Bot berjalan...");
