require("dotenv").config();

/* =========================
   GLOBAL ERROR HANDLER
========================= */
process.on("uncaughtException", (err) => {
  console.log("UNCAUGHT ERROR:", err.message);
});
process.on("unhandledRejection", (err) => {
  console.log("UNHANDLED PROMISE:", err);
});

const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const Imap = require("node-imap");
const { simpleParser } = require("mailparser");

/* =========================
   CONFIG
========================= */
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const app = express();

const ADMIN_ID = process.env.ADMIN_ID?.toString();
const PORT = process.env.PORT || 3000;

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

/* =========================
   MENU FUNCTION
========================= */
function mainMenu(chatId) {
  bot.sendMessage(chatId,
`🤖 *MENU UTAMA*

Silakan pilih menu:`,
{
  parse_mode: "Markdown",
  reply_markup: {
    keyboard: [
      ["📦 Titip Paket"],
      ["📄 Cek Status"],
      ["ℹ️ Bantuan"]
    ],
    resize_keyboard: true
  }
});
}

/* =========================
   START
========================= */
bot.onText(/\/start/, (msg) => {
  mainMenu(msg.chat.id);
});

/* =========================
   HITUNG HARGA
========================= */
function hitungHarga(berat) {
  return (10000 * berat) + 2000;
}

/* =========================
   HANDLE MESSAGE
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

  if (text === "📄 Cek Status") {
    return bot.sendMessage(chatId, "Kirim ID Transaksi Anda.");
  }

  if (text === "ℹ️ Bantuan") {
    return bot.sendMessage(chatId,
"Hubungi admin jika ada kendala.");
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
      return bot.sendMessage(chatId, "Masukkan angka berat valid.");
    }

    const total = hitungHarga(berat);

    users[chatId].berat = berat;
    users[chatId].total = total;
    users[chatId].step = 4;

    return bot.sendMessage(chatId,
`📦 *KONFIRMASI*

Pengirim: ${users[chatId].nama}
Penerima: ${users[chatId].penerima}
Berat: ${berat} kg
Total: Rp${total}

Ketik SUDAH setelah transfer`,
{ parse_mode: "Markdown" });
  }

  if (users[chatId].step === 4 && text.toUpperCase() === "SUDAH") {

    const idTransaksi = "TRX" + Date.now();

    transaksi.push({
      id: idTransaksi,
      user: chatId,
      data: users[chatId]
    });

    bot.sendMessage(chatId,
`✅ Pembayaran diterima.
ID Transaksi: ${idTransaksi}`);

    if (ADMIN_ID) {
      bot.sendMessage(ADMIN_ID,
`🔔 TRANSAKSI BARU

ID: ${idTransaksi}
Pengirim: ${users[chatId].nama}
Penerima: ${users[chatId].penerima}
Berat: ${users[chatId].berat} kg
Total: Rp${users[chatId].total}

Kirim:
/resi ${idTransaksi} NOMORRESI`);
    }

    users[chatId] = { step: 0 };
    mainMenu(chatId);
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
`📦 *RESI SUDAH DIBUAT*

Nomor Resi: ${nomorResi}`,
{ parse_mode: "Markdown" });

  bot.sendMessage(msg.chat.id, "Resi berhasil dikirim.");
});

/* =========================
   EMAIL MONITOR (AMAN)
========================= */
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {

  const imap = new Imap({
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASS,
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    tls: false
  });

  imap.once("ready", function () {
    imap.openBox("INBOX", false, function (err, box) {
      if (err) return console.log(err);

      imap.on("mail", function () {

        const f = imap.seq.fetch(box.messages.total + ":*", {
          bodies: ""
        });

        f.on("message", function (msg) {

          msg.on("body", function (stream) {

            simpleParser(stream, async (err, parsed) => {
              if (err) return;

              const subject = parsed.subject || "";
              const body = parsed.text || "";

              const linkMatch = body.match(/https?:\/\/[^\s]+/);

              if (linkMatch && subject.toLowerCase().includes("aktivasi")) {

                bot.sendMessage(ADMIN_ID,
`📩 EMAIL AKTIVASI TERDETEKSI

Subject: ${subject}

Link:
${linkMatch[0]}`);
              }

            });
          });
        });
      });
    });
  });

  imap.connect();
}

console.log("Bot Sistem Lengkap Aktif ✅");
