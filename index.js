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

let users = {};

// MENU UTAMA
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id,
`🚀 *LAYANAN TITIP PAKET*

Silakan pilih menu 👇`,
{
  parse_mode: "Markdown",
  reply_markup: {
    keyboard: [
      ["📦 Titip Paket"],
      ["❌ Batal"]
    ],
    resize_keyboard: true
  }
});
});

// HANDLE MESSAGE
bot.on("message", (msg) => {

  const chatId = msg.chat.id;
  const text = msg.text;

  if (!users[chatId]) users[chatId] = { step: 0 };

  // BATALKAN
  if (text === "❌ Batal") {
    users[chatId] = { step: 0 };
    return bot.sendMessage(chatId, "Transaksi dibatalkan.");
  }

  // MULAI TITIP
  if (text === "📦 Titip Paket") {
    users[chatId] = { step: 1 };
    return bot.sendMessage(chatId, "Masukkan *Nama Pengirim:*", { parse_mode: "Markdown" });
  }

  // STEP 1
  if (users[chatId].step === 1) {
    users[chatId].namaPengirim = text;
    users[chatId].step = 2;
    return bot.sendMessage(chatId, "Masukkan *Alamat Pengirim:*", { parse_mode: "Markdown" });
  }

  // STEP 2
  if (users[chatId].step === 2) {
    users[chatId].alamatPengirim = text;
    users[chatId].step = 3;
    return bot.sendMessage(chatId, "Masukkan *Nama Penerima:*", { parse_mode: "Markdown" });
  }

  // STEP 3
  if (users[chatId].step === 3) {
    users[chatId].namaPenerima = text;
    users[chatId].step = 4;
    return bot.sendMessage(chatId, "Masukkan *Alamat Penerima:*", { parse_mode: "Markdown" });
  }

  // STEP 4
  if (users[chatId].step === 4) {
    users[chatId].alamatPenerima = text;
    users[chatId].step = 5;
    return bot.sendMessage(chatId, "Masukkan *Berat Paket (kg):*", { parse_mode: "Markdown" });
  }

  // STEP 5 (KONFIRMASI)
  if (users[chatId].step === 5) {

    const berat = parseFloat(text);

    if (isNaN(berat)) {
      return bot.sendMessage(chatId, "Masukkan angka berat yang valid.");
    }

    users[chatId].berat = berat;
    users[chatId].step = 6;

    return bot.sendMessage(chatId,
`📦 *KONFIRMASI DATA*

Nama Pengirim: ${users[chatId].namaPengirim}
Alamat Pengirim: ${users[chatId].alamatPengirim}

Nama Penerima: ${users[chatId].namaPenerima}
Alamat Penerima: ${users[chatId].alamatPenerima}

Berat: ${berat} kg

Ketik *YA* untuk lanjut.`,
{ parse_mode: "Markdown" });
  }

  // FINAL
  if (users[chatId].step === 6 && text.toUpperCase() === "YA") {

    const resi = "INDO" + Date.now();

    bot.sendMessage(chatId,
`✅ *TITIP PAKET BERHASIL*

Nomor Resi:
${resi}

Terima kasih 🙏`,
{ parse_mode: "Markdown" });

    users[chatId] = { step: 0 };
  }

});
