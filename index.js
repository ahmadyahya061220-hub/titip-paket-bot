require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const app = express();

const ADMIN_ID = process.env.ADMIN_ID; // isi dengan ID telegram admin
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Bot Titip Paket Aktif ✅");
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});

let users = {};
let transaksi = [];

function generateResi() {
  return "INDO" + Date.now();
}

function hitungHarga(berat) {
  const hargaPerKg = 10000;
  const profit = 2000;
  return (hargaPerKg * berat) + profit;
}

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id,
`Selamat datang di Layanan Titip Paket 🚀

Silakan pilih menu`,
{
  reply_markup: {
    keyboard: [["📦 Titip Paket"], ["📊 Cek Transaksi"]],
    resize_keyboard: true
  }
});
});

bot.on("message", async (msg) => {

  const chatId = msg.chat.id;
  const text = msg.text;

  if (!users[chatId]) users[chatId] = { step: 0 };

  if (text === "📦 Titip Paket") {
    users[chatId] = { step: 1 };
    bot.sendMessage(chatId, "Masukkan Nama Pengirim:");
  }

  else if (users[chatId].step === 1) {
    users[chatId].namaPengirim = text;
    users[chatId].step = 2;
    bot.sendMessage(chatId, "Masukkan Nama Penerima:");
  }

  else if (users[chatId].step === 2) {
    users[chatId].namaPenerima = text;
    users[chatId].step = 3;
    bot.sendMessage(chatId, "Masukkan Berat (kg):");
  }

  else if (users[chatId].step === 3) {

    const berat = parseInt(text);
    const total = hitungHarga(berat);

    users[chatId].berat = berat;
    users[chatId].total = total;
    users[chatId].step = 4;

    bot.sendMessage(chatId,
`📦 KONFIRMASI

Pengirim: ${users[chatId].namaPengirim}
Penerima: ${users[chatId].namaPenerima}
Berat: ${berat} kg

Total Bayar: Rp${total}

Ketik YA untuk proses`);
  }

  else if (users[chatId].step === 4 && text.toUpperCase() === "YA") {

    const resi = generateResi();

    transaksi.push({
      user: chatId,
      resi: resi,
      total: users[chatId].total
    });

    bot.sendMessage(chatId,
`✅ BERHASIL

Nomor Resi:
${resi}

Silakan lakukan pengiriman sesuai prosedur resmi.
Terima kasih 🙏`);

    if (chatId.toString() !== ADMIN_ID) {
      bot.sendMessage(ADMIN_ID,
`🔔 Transaksi Baru

User: ${chatId}
Resi: ${resi}
Total: Rp${users[chatId].total}`);
    }

    users[chatId] = { step: 0 };
  }

  else if (text === "📊 Cek Transaksi" && chatId.toString() === ADMIN_ID) {
    bot.sendMessage(chatId, `Total Transaksi: ${transaksi.length}`);
  }

});
