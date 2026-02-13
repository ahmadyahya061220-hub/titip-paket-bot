require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const express = require("express");

const app = express();
app.use(express.json());

const PORT = process.env.PORT;
const TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID?.toString();

if (!TOKEN) {
  console.log("BOT_TOKEN tidak ditemukan");
  process.exit(1);
}

/* =========================
   WEBHOOK SETUP
========================= */

const bot = new TelegramBot(TOKEN);

const url = process.env.RAILWAY_STATIC_URL 
  ? `https://${process.env.RAILWAY_STATIC_URL}`
  : process.env.WEBHOOK_URL;

bot.setWebHook(`${url}/bot${TOKEN}`);

app.post(`/bot${TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

/* =========================
   MENU
========================= */

let users = {};
let transaksi = [];

function mainMenu(chatId) {
  bot.sendMessage(chatId,
`🤖 MENU UTAMA

Pilih menu:`,
{
  reply_markup: {
    keyboard: [
      ["📦 Titip Paket"],
      ["ℹ️ Bantuan"]
    ],
    resize_keyboard: true
  }
});
}

bot.onText(/\/start/, (msg) => {
  mainMenu(msg.chat.id);
});

function hitungHarga(berat) {
  return (10000 * berat) + 2000;
}

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
ID: ${idTransaksi}`);

    if (ADMIN_ID) {
      bot.sendMessage(ADMIN_ID,
`TRANSAKSI BARU

ID: ${idTransaksi}

Gunakan:
/resi ${idTransaksi} NOMORRESI`);
    }

    users[chatId] = { step: 0 };
    mainMenu(chatId);
  }

});

bot.onText(/\/resi (.+) (.+)/, (msg, match) => {

  if (msg.chat.id.toString() !== ADMIN_ID) return;

  const id = match[1];
  const nomorResi = match[2];

  const trx = transaksi.find(t => t.id === id);
  if (!trx) return bot.sendMessage(msg.chat.id, "ID tidak ditemukan.");

  bot.sendMessage(trx.user,
`RESI: ${nomorResi}`);

  bot.sendMessage(msg.chat.id, "Resi terkirim.");
});

/* =========================
   SERVER START
========================= */

app.get("/", (req, res) => {
  res.send("Bot Railway Aktif ✅");
});

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
