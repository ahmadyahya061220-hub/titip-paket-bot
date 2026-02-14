require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");

const token = process.env.BOT_TOKEN;

if (!token) {
  console.error("❌ BOT_TOKEN tidak ditemukan di .env");
  process.exit(1);
}

const isRailway = process.env.RAILWAY_STATIC_URL ? true : false;

let bot;

if (isRailway) {
  // ===== WEBHOOK MODE (Railway) =====
  const app = express();
  app.use(express.json());

  bot = new TelegramBot(token);

  const url = `https://${process.env.RAILWAY_STATIC_URL}/bot${token}`;

  bot.setWebHook(url);

  app.post(`/bot${token}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
  });

  app.get("/", (req, res) => {
    res.send("Bot aktif (webhook mode) 🚀");
  });

  app.listen(process.env.PORT || 3000, () => {
    console.log("🚀 Bot berjalan (Railway Webhook)");
  });

} else {
  // ===== POLLING MODE (Local / VPS) =====
  bot = new TelegramBot(token, { polling: true });
  console.log("🚀 Bot berjalan (Polling Mode)");
}

// ================= ERROR HANDLER =================
bot.on("polling_error", console.log);
process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);

// ================= MENU =================
const menuKeyboard = {
  reply_markup: {
    keyboard: [
      ["💰 Beli limit", "🛢 Cek limit"],
      ["🔥 Pelaksanaan PJR", "📚 Listing produk"]
    ],
    resize_keyboard: true
  }
};

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "🤖 MKR BOT AKTIF\n\nSilakan pilih menu:", menuKeyboard);
});

bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (text === "💰 Beli limit") {
    bot.sendMessage(chatId, "Gunakan /sawer untuk beli limit.");
  }

  if (text === "🛢 Cek limit") {
    bot.sendMessage(chatId, "Limit kamu: 100");
  }

  if (text === "🔥 Pelaksanaan PJR") {
    bot.sendMessage(chatId, "Gunakan /pjr");
  }

  if (text === "📚 Listing produk") {
    bot.sendMessage(chatId, "Gunakan /rak");
  }
});
