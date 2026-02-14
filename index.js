require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error("BOT_TOKEN tidak ditemukan!");
  process.exit(1);
}

const isRailway = process.env.RAILWAY_STATIC_URL ? true : false;
let bot;

// ===== SETUP BOT MODE =====
if (isRailway) {
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
    res.send("Bot Titip Paket Aktif 🚀");
  });

  app.listen(process.env.PORT || 3000);
  console.log("Bot berjalan (Webhook Mode)");
} else {
  bot = new TelegramBot(token, { polling: true });
  console.log("Bot berjalan (Polling Mode)");
}

// ===== ANTI CRASH =====
bot.on("polling_error", console.log);
process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);

// ===== DATA SEMENTARA =====
const userSession = {};

// ===== MENU UTAMA =====
const mainMenu = {
  reply_markup: {
    keyboard: [
      ["📦 Titip Paket"],
      ["💰 Cek Tarif"],
      ["📄 Cek Resi"],
      ["ℹ️ Bantuan"]
    ],
    resize_keyboard: true
  }
};

// ===== START =====
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "🤖 BOT TITIP PAKET\n\nSilakan pilih menu:",
    mainMenu
  );
});

// ===== HANDLE MENU =====
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (text === "📦 Titip Paket") {
    userSession[chatId] = { step: "berat" };
    bot.sendMessage(chatId, "Masukkan berat paket (kg):");
  }

  else if (text === "💰 Cek Tarif") {
    bot.sendMessage(chatId, "Tarif Rp 1.000/paket");
  }

  else if (text === "📄 Cek Resi") {
    bot.sendMessage(chatId, "Masukkan nomor resi:");
    userSession[chatId] = { step: "cek_resi" };
  }

  else if (text === "ℹ️ Bantuan") {
    bot.sendMessage(chatId, "Hubungi admin untuk bantuan.");
  }

  // ===== STEP FORM TITIP PAKET =====
  else if (userSession[chatId]?.step === "berat") {
    userSession[chatId].berat = text;
    userSession[chatId].step = "panjang";
    bot.sendMessage(chatId, "Masukkan panjang (cm):");
  }

  else if (userSession[chatId]?.step === "panjang") {
    userSession[chatId].panjang = text;
    userSession[chatId].step = "lebar";
    bot.sendMessage(chatId, "Masukkan lebar (cm):");
  }

  else if (userSession[chatId]?.step === "lebar") {
    userSession[chatId].lebar = text;
    userSession[chatId].step = "tinggi";
    bot.sendMessage(chatId, "Masukkan tinggi (cm):");
  }

  else if (userSession[chatId]?.step === "tinggi") {
    userSession[chatId].tinggi = text;

    const resi = "IDP" + Math.floor(Math.random() * 1000000000);

    bot.sendMessage(
      chatId,
      `✅ Paket berhasil dibuat!\n\n` +
      `📦 Berat: ${userSession[chatId].berat} kg\n` +
      `📏 Dimensi: ${userSession[chatId].panjang}x${userSession[chatId].lebar}x${userSession[chatId].tinggi} cm\n\n` +
      `🧾 Nomor Resi: ${resi}`
    );

    delete userSession[chatId];
  }

  else if (userSession[chatId]?.step === "cek_resi") {
    bot.sendMessage(chatId, `Status resi ${text} sedang diproses.`);
    delete userSession[chatId];
  }
});
