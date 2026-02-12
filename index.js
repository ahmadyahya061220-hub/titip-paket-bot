require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const app = express();

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Bot Titip Paket Aktif ✅");
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});

// MENU UTAMA
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id,
`🚀 *LAYANAN TITIP PAKET*

Silakan pilih menu di bawah ini 👇`,
{
  parse_mode: "Markdown",
  reply_markup: {
    keyboard: [
      ["📦 Titip Paket"],
      ["💰 Cek Harga", "📊 Cek Resi"],
      ["☎️ Customer Service"]
    ],
    resize_keyboard: true
  }
});
});

// RESPON MENU
bot.on("message", (msg) => {

  const chatId = msg.chat.id;
  const text = msg.text;

  if (text === "📦 Titip Paket") {
    bot.sendMessage(chatId,
`📦 *TITIP PAKET*

Silakan kirim data berikut:

Nama Pengirim:
Alamat Pengirim:
Nama Penerima:
Alamat Penerima:
Berat (kg):`,
{ parse_mode: "Markdown" });
  }

  else if (text === "💰 Cek Harga") {
    bot.sendMessage(chatId,
`💰 *CEK HARGA*

Contoh harga:
1kg = Rp12.000
2kg = Rp20.000
3kg = Rp28.000

Harga sudah termasuk biaya admin.`,
{ parse_mode: "Markdown" });
  }

  else if (text === "📊 Cek Resi") {
    bot.sendMessage(chatId,
`📊 *CEK RESI*

Silakan kirim nomor resi Anda.`,
{ parse_mode: "Markdown" });
  }

  else if (text === "☎️ Customer Service") {
    bot.sendMessage(chatId,
`☎️ *CUSTOMER SERVICE*

Hubungi admin:
@username_admin`,
{ parse_mode: "Markdown" });
  }

});
