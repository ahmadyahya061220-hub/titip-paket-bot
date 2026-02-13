require("dotenv").config();

process.on("uncaughtException", (err) => {
  console.log("UNCAUGHT ERROR:", err.message);
});

process.on("unhandledRejection", (err) => {
  console.log("UNHANDLED PROMISE:", err);
});

const TelegramBot = require("node-telegram-bot-api");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.BOT_TOKEN) {
  console.log("BOT_TOKEN tidak ada di .env");
  process.exit(1);
}

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

const ADMIN_ID = process.env.ADMIN_ID
  ? process.env.ADMIN_ID.toString()
  : null;

/* =========================
   EXPRESS SERVER
========================= */
app.get("/", (req, res) => {
  res.send("Bot Aktif ✅");
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});

/* =========================
   DATA
========================= */
let users = {};
let transaksi = [];

function hitungHarga(berat) {
  const hargaPerKg = 10000;
  const profit = 2000;
  return (hargaPerKg * berat) + profit;
}

/* =========================
   START MENU
========================= */
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id,
`🚀 LAYANAN TITIP PAKET

Klik 📦 Titip Paket`,
{
  reply_markup: {
    keyboard: [["📦 Titip Paket"]],
    resize_keyboard: true
  }
});
});

/* =========================
   HANDLE USER
========================= */
bot.on("message", (msg) => {

  const chatId = msg.chat.id;
  const text = msg.text;

  if (!text) return;

  if (!users[chatId]) users[chatId] = { step: 0 };

  if (text === "📦 Titip Paket") {
    users[chatId] = { step: 1 };
    return bot.sendMessage(chatId, "Masukkan Nama Pengirim:");
  }

  if (users[chatId].step === 1) {
    users[chatId].nama = text;
    users[chatId].step = 2;
    return bot.sendMessage(chatId, "Masukkan Nama Penerima:");
  }

  if (users[chatId].step === 2) {
    users[chatId].penerima = text;
    users[chatId].step = 3;
    return bot.sendMessage(chatId, "Masukkan Berat (kg):");
  }

  if (users[chatId].step === 3) {

    const berat = parseInt(text);
    if (isNaN(berat)) {
      return bot.sendMessage(chatId, "Masukkan angka yang benar.");
    }

    const total = hitungHarga(berat);

    users[chatId].berat = berat;
    users[chatId].total = total;
    users[chatId].step = 4;

    return bot.sendMessage(chatId,
`KONFIRMASI

Pengirim: ${users[chatId].nama}
Penerima: ${users[chatId].penerima}
Berat: ${berat} kg
Total: Rp${total}

Ketik SUDAH setelah transfer`);
  }

  if (users[chatId].step === 4 && text.toUpperCase() === "SUDAH") {

    const idTransaksi = "TRX" + Date.now();

    transaksi.push({
      id: idTransaksi,
      user: chatId,
      data: users[chatId]
    });

    bot.sendMessage(chatId,
`Pembayaran diterima.
ID Transaksi: ${idTransaksi}`);

    if (ADMIN_ID) {
      bot.sendMessage(ADMIN_ID,
`TRANSAKSI BARU

ID: ${idTransaksi}
User: ${chatId}
Pengirim: ${users[chatId].nama}
Penerima: ${users[chatId].penerima}
Berat: ${users[chatId].berat} kg
Total: Rp${users[chatId].total}

Gunakan:
/resi ${idTransaksi} NOMORRESI`);
    }

    users[chatId] = { step: 0 };
  }

});

/* =========================
   ADMIN KIRIM RESI
========================= */
bot.onText(/\/resi (.+) (.+)/, (msg, match) => {

  if (!ADMIN_ID) return;
  if (msg.chat.id.toString() !== ADMIN_ID) return;

  const id = match[1];
  const nomorResi = match[2];

  const trx = transaksi.find(t => t.id === id);
  if (!trx) {
    return bot.sendMessage(msg.chat.id, "ID tidak ditemukan.");
  }

  bot.sendMessage(trx.user,
`RESI SUDAH DIBUAT
Nomor Resi: ${nomorResi}`);

  bot.sendMessage(msg.chat.id, "Resi berhasil dikirim.");
});

console.log("Bot Stabil Aktif ✅");
