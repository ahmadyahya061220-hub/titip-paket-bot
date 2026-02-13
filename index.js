const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

const app = express();
app.get("/", (req, res) => {
  res.send("Bot Titip Paket Aktif ✅");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});

// Anti crash
process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);

// MENU UTAMA
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(chatId, "Selamat datang di Bot Titip Paket 📦", {
    reply_markup: {
      keyboard: [
        ["📦 Titip Paket"],
        ["📄 Cek Resi"]
      ],
      resize_keyboard: true
    }
  });
});

// MENU TITIP PAKET
bot.on("message", (msg) => {
  const chatId = msg.chat.id;

  if (msg.text === "📦 Titip Paket") {

    const berat = 1;
    const harga = 12000;

    const transaksiId = "TRX" + Date.now();
    const resi = "RESI" + Math.floor(Math.random() * 1000000000);

    bot.sendMessage(chatId,
`📦 DETAIL PAKET

Berat: ${berat} kg
Total: Rp${harga}

✅ Pembayaran diterima
ID Transaksi: ${transaksiId}

🎫 Nomor Resi:
${resi}`
    );
  }
});
