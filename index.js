const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const nodemailer = require('nodemailer');

const token = process.env.BOT_TOKEN;

if (!token) {
  console.error("BOT_TOKEN tidak ditemukan!");
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Bot Usaha Titip Paket Online ✅");
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});

process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

console.log("Bot siap menerima pesan...");

// ================= DATABASE SEMENTARA =================
let users = {};
let state = {};
let emailData = {};

const TARIF_PER_KG = 12000;

// ================= MENU =================
function mainMenu(chatId) {
  bot.sendMessage(chatId, "📦 MENU USAHA TITIP PAKET", {
    reply_markup: {
      keyboard: [
        ["📦 Titip Paket", "💰 Cek Tarif"],
        ["✉ Aktivasi Email", "👤 Profil"]
      ],
      resize_keyboard: true
    }
  });
}

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  if (!users[chatId]) {
    users[chatId] = {
      saldo: 50000,
      verified: false
    };
  }

  mainMenu(chatId);
});

// ================= MESSAGE HANDLER =================
bot.on("message", async (msg) => {

  const chatId = msg.chat.id;
  const text = msg.text;
  if (!text) return;

  console.log("Pesan:", text);

  // ================= CEK TARIF =================
  if (text === "💰 Cek Tarif") {
    return bot.sendMessage(chatId,
`📦 Tarif Pengiriman

Berat: 1 kg
Dimensi: 10 x 10 x 10 cm
Harga: Rp${TARIF_PER_KG}`
    );
  }

  // ================= PROFIL =================
  if (text === "👤 Profil") {
    const user = users[chatId];
    return bot.sendMessage(chatId,
`👤 PROFIL ANDA

Saldo: Rp${user.saldo}
Email Verified: ${user.verified ? "✅ Ya" : "❌ Belum"}`
    );
  }

  // ================= TITIP PAKET =================
  if (text === "📦 Titip Paket") {

    if (!users[chatId].verified) {
      return bot.sendMessage(chatId, "❌ Aktivasi email terlebih dahulu.");
    }

    if (users[chatId].saldo < TARIF_PER_KG) {
      return bot.sendMessage(chatId, "❌ Saldo tidak cukup.");
    }

    state[chatId] = { step: "pengirim" };
    return bot.sendMessage(chatId, "Masukkan Nama Pengirim:");
  }

  if (state[chatId]?.step === "pengirim") {
    state[chatId].pengirim = text;
    state[chatId].step = "penerima";
    return bot.sendMessage(chatId, "Masukkan Nama Penerima:");
  }

  if (state[chatId]?.step === "penerima") {
    state[chatId].penerima = text;

    users[chatId].saldo -= TARIF_PER_KG;

    const transaksiId = "TRX" + Date.now();
    const resi = "RESI" + Math.floor(Math.random() * 1000000000);

    await bot.sendMessage(chatId,
`📦 DETAIL PAKET

Pengirim: ${state[chatId].pengirim}
Penerima: ${state[chatId].penerima}

Berat: 1 kg
Dimensi: 10 x 10 x 10

💰 Biaya: Rp${TARIF_PER_KG}

✅ ID Transaksi: ${transaksiId}
🎫 Nomor Resi: ${resi}

Saldo Tersisa: Rp${users[chatId].saldo}`
    );

    delete state[chatId];
    return;
  }

  // ================= AKTIVASI EMAIL =================
  if (text === "✉ Aktivasi Email") {
    emailData[chatId] = { step: "input_email" };
    return bot.sendMessage(chatId, "Masukkan email Anda:");
  }

  if (emailData[chatId]?.step === "input_email") {

    const email = text;
    const code = Math.floor(100000 + Math.random() * 900000);

    emailData[chatId] = {
      step: "verifikasi",
      email,
      code
    };

    try {

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });

      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Kode Aktivasi Titip Paket",
        text: "Kode verifikasi Anda: " + code
      });

      return bot.sendMessage(chatId, "✅ Kode dikirim. Masukkan kode:");

    } catch (err) {
      console.error("EMAIL ERROR:", err);
      delete emailData[chatId];
      return bot.sendMessage(chatId, "❌ Gagal kirim email. Cek konfigurasi.");
    }
  }

  if (emailData[chatId]?.step === "verifikasi") {

    if (text == emailData[chatId].code) {
      users[chatId].verified = true;
      delete emailData[chatId];
      return bot.sendMessage(chatId, "✅ Email berhasil diverifikasi!");
    } else {
      return bot.sendMessage(chatId, "❌ Kode salah.");
    }
  }

});
