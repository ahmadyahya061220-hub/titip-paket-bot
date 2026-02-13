require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const Imap = require("node-imap");
const { simpleParser } = require("mailparser");

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const app = express();

const ADMIN_ID = process.env.ADMIN_ID;
const PORT = process.env.PORT || 3000;

/* =========================
   EXPRESS SERVER
========================= */
app.get("/", (req, res) => {
  res.send("Bot Titip Paket + Email Monitor Aktif ✅");
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});

/* =========================
   DATA STORAGE
========================= */
let users = {};
let transaksi = [];

/* =========================
   FUNGSI HITUNG HARGA
========================= */
function hitungHarga(berat) {
  const hargaPerKg = 10000;
  const profit = 2000;
  return (hargaPerKg * berat) + profit;
}

/* =========================
   MENU START
========================= */
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id,
`🚀 *LAYANAN TITIP PAKET*

Klik 📦 Titip Paket untuk mulai`,
{
  parse_mode: "Markdown",
  reply_markup: {
    keyboard: [["📦 Titip Paket"]],
    resize_keyboard: true
  }
});
});

/* =========================
   HANDLE MESSAGE USER
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
    if (isNaN(berat)) return bot.sendMessage(chatId, "Masukkan angka berat yang valid.");

    const total = hitungHarga(berat);

    users[chatId].berat = berat;
    users[chatId].total = total;
    users[chatId].step = 4;

    return bot.sendMessage(chatId,
`📦 *KONFIRMASI*

Pengirim: ${users[chatId].nama}
Penerima: ${users[chatId].penerima}
Berat: ${berat} kg

Total Bayar: Rp${total}

Silakan transfer ke:
DANA/OVO/BCA XXXXX

Setelah transfer ketik: SUDAH`,
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
`⏳ Pembayaran diterima.
Admin sedang memproses.

ID Transaksi: ${idTransaksi}`);

    bot.sendMessage(ADMIN_ID,
`🔔 TRANSAKSI BARU

ID: ${idTransaksi}
User: ${chatId}
Pengirim: ${users[chatId].nama}
Penerima: ${users[chatId].penerima}
Berat: ${users[chatId].berat} kg
Total: Rp${users[chatId].total}

Setelah buat resi kirim:
/resi ${idTransaksi} NOMORRESI`);

    users[chatId] = { step: 0 };
  }

});

/* =========================
   ADMIN KIRIM RESI
========================= */
bot.onText(/\/resi (.+) (.+)/, (msg, match) => {

  if (msg.chat.id.toString() !== ADMIN_ID) return;

  const id = match[1];
  const nomorResi = match[2];

  const trx = transaksi.find(t => t.id === id);
  if (!trx) return bot.sendMessage(msg.chat.id, "ID tidak ditemukan.");

  bot.sendMessage(trx.user,
`✅ *RESI SUDAH DIBUAT*

Nomor Resi: ${nomorResi}

Terima kasih 🙏`,
{ parse_mode: "Markdown" });

  bot.sendMessage(msg.chat.id, "Resi berhasil dikirim ke user.");
});

/* =========================
   EMAIL MONITOR (PROTON BRIDGE)
========================= */

const imap = new Imap({
  user: process.env.EMAIL_USER,
  password: process.env.EMAIL_PASS,
  host: "127.0.0.1",
  port: 1143,
  tls: false
});

function openInbox(cb) {
  imap.openBox("INBOX", false, cb);
}

imap.once("ready", function () {
  openInbox(function (err, box) {
    if (err) throw err;

    imap.on("mail", function () {

      const f = imap.seq.fetch(box.messages.total + ":*", {
        bodies: ""
      });

      f.on("message", function (msg) {

        msg.on("body", function (stream) {

          simpleParser(stream, async (err, parsed) => {

            const subject = parsed.subject || "";
            const body = parsed.text || "";

            const linkMatch = body.match(/https?:\/\/[^\s]+/);

            if (linkMatch && subject.toLowerCase().includes("aktivasi")) {

              const activationLink = linkMatch[0];

              bot.sendMessage(ADMIN_ID,
`📩 EMAIL AKTIVASI TERDETEKSI

Subject: ${subject}

Link:
${activationLink}`);
            }

          });
        });
      });
    });
  });
});

imap.connect();

console.log("Bot Full System Aktif ✅");
