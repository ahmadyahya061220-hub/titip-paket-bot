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

bot.on("polling_error", console.log);
process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);

const userSession = {};

const mainMenu = {
  reply_markup: {
    keyboard: [
      ["📦 Titip Paket"],
      ["💰 Cek Tarif"],
      ["📄 Cek Resi"]
    ],
    resize_keyboard: true
  }
};

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "🤖 BOT TITIP PAKET USAHA\n\nPilih menu:", mainMenu);
});

bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (text === "📦 Titip Paket") {
    userSession[chatId] = { step: "nama_pengirim" };
    bot.sendMessage(chatId, "Masukkan NAMA PENGIRIM:");
  }

  else if (text === "💰 Cek Tarif") {
    bot.sendMessage(chatId, "Tarif dasar 1kg = Rp15.000");
  }

  else if (text === "📄 Cek Resi") {
    userSession[chatId] = { step: "cek_resi" };
    bot.sendMessage(chatId, "Masukkan nomor resi:");
  }

  // ===== FORM STEP =====

  else if (userSession[chatId]?.step === "nama_pengirim") {
    userSession[chatId].nama_pengirim = text;
    userSession[chatId].step = "hp_pengirim";
    bot.sendMessage(chatId, "Masukkan NO HP PENGIRIM:");
  }

  else if (userSession[chatId]?.step === "hp_pengirim") {
    userSession[chatId].hp_pengirim = text;
    userSession[chatId].step = "nama_penerima";
    bot.sendMessage(chatId, "Masukkan NAMA PENERIMA:");
  }

  else if (userSession[chatId]?.step === "nama_penerima") {
    userSession[chatId].nama_penerima = text;
    userSession[chatId].step = "hp_penerima";
    bot.sendMessage(chatId, "Masukkan NO HP PENERIMA:");
  }

  else if (userSession[chatId]?.step === "hp_penerima") {
    userSession[chatId].hp_penerima = text;
    userSession[chatId].step = "alamat_penerima";
    bot.sendMessage(chatId, "Masukkan ALAMAT PENERIMA:");
  }

  else if (userSession[chatId]?.step === "alamat_penerima") {
    userSession[chatId].alamat_penerima = text;
    userSession[chatId].step = "berat";
    bot.sendMessage(chatId, "Masukkan BERAT (kg):");
  }

  else if (userSession[chatId]?.step === "berat") {
    userSession[chatId].berat = text;
    userSession[chatId].step = "panjang";
    bot.sendMessage(chatId, "Masukkan PANJANG (cm):");
  }

  else if (userSession[chatId]?.step === "panjang") {
    userSession[chatId].panjang = text;
    userSession[chatId].step = "lebar";
    bot.sendMessage(chatId, "Masukkan LEBAR (cm):");
  }

  else if (userSession[chatId]?.step === "lebar") {
    userSession[chatId].lebar = text;
    userSession[chatId].step = "tinggi";
    bot.sendMessage(chatId, "Masukkan TINGGI (cm):");
  }

  else if (userSession[chatId]?.step === "tinggi") {

    userSession[chatId].tinggi = text;

    const resi = "IDP" + Date.now();

    bot.sendMessage(chatId,
      `✅ DATA PAKET BERHASIL DIBUAT\n\n` +
      `👤 Pengirim: ${userSession[chatId].nama_pengirim}\n` +
      `📞 HP Pengirim: ${userSession[chatId].hp_pengirim}\n\n` +
      `👤 Penerima: ${userSession[chatId].nama_penerima}\n` +
      `📞 HP Penerima: ${userSession[chatId].hp_penerima}\n` +
      `🏠 Alamat: ${userSession[chatId].alamat_penerima}\n\n` +
      `📦 Berat: ${userSession[chatId].berat} kg\n` +
      `📏 Dimensi: ${userSession[chatId].panjang}x${userSession[chatId].lebar}x${userSession[chatId].tinggi} cm\n\n` +
      `🧾 NOMOR RESI: ${resi}`
    );

    delete userSession[chatId];
  }

  else if (userSession[chatId]?.step === "cek_resi") {
    bot.sendMessage(chatId, `Status resi ${text} sedang diproses.`);
    delete userSession[chatId];
  }
});
