const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const nodemailer = require("nodemailer");

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error("BOT_TOKEN tidak ditemukan!");
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => res.send("🚀 Titip Paket PRO Online"));
app.listen(PORT, () => console.log("Server running on port " + PORT));

process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

console.log("Bot siap...");

// ================= DATABASE SEMENTARA =================
let users = {};
let state = {};
let emailState = {};

const TARIF = 12000;

// ================= MENU PROFESIONAL =================
function mainMenu(chatId) {
  bot.sendMessage(chatId,
`🚚 *TITIP PAKET EXPRESS*
Solusi Kirim Paket Cepat & Aman

Silakan pilih layanan di bawah ini:`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "📦 Titip Paket", callback_data: "titip" },
            { text: "💰 Cek Tarif", callback_data: "tarif" }
          ],
          [
            { text: "✉ Aktivasi Email", callback_data: "aktivasi" },
            { text: "👤 Profil Saya", callback_data: "profil" }
          ]
        ]
      }
    }
  );
}

// ================= START =================
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

// ================= CALLBACK BUTTON =================
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (data === "tarif") {
    bot.sendMessage(chatId,
`💰 *INFORMASI TARIF*

Berat: 1 kg
Dimensi: 10 x 10 x 10 cm
Harga: Rp${TARIF}`,
      { parse_mode: "Markdown" }
    );
  }

  if (data === "profil") {
    const user = users[chatId];
    bot.sendMessage(chatId,
`👤 *PROFIL ANDA*

Saldo: Rp${user.saldo}
Email Verified: ${user.verified ? "✅ Ya" : "❌ Belum"}`,
      { parse_mode: "Markdown" }
    );
  }

  if (data === "titip") {

    if (!users[chatId].verified) {
      return bot.sendMessage(chatId, "❌ Aktivasi email terlebih dahulu.");
    }

    if (users[chatId].saldo < TARIF) {
      return bot.sendMessage(chatId, "❌ Saldo tidak cukup.");
    }

    state[chatId] = { step: "pengirim" };
    bot.sendMessage(chatId, "Masukkan *Nama Pengirim:*", { parse_mode: "Markdown" });
  }

  if (data === "aktivasi") {
    emailState[chatId] = { step: "email" };
    bot.sendMessage(chatId, "Masukkan email Anda:");
  }

  bot.answerCallbackQuery(query.id);
});

// ================= MESSAGE FLOW =================
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  if (!text) return;

  // ===== TITIP FLOW =====
  if (state[chatId]?.step === "pengirim") {
    state[chatId].pengirim = text;
    state[chatId].step = "penerima";
    return bot.sendMessage(chatId, "Masukkan *Nama Penerima:*", { parse_mode: "Markdown" });
  }

  if (state[chatId]?.step === "penerima") {

    state[chatId].penerima = text;
    users[chatId].saldo -= TARIF;

    const trx = "TRX" + Date.now();
    const resi = "RESI" + Math.floor(Math.random() * 999999999);

    await bot.sendMessage(chatId,
`📦 *DETAIL TRANSAKSI*

Pengirim: ${state[chatId].pengirim}
Penerima: ${state[chatId].penerima}

Berat: 1 kg
Dimensi: 10 x 10 x 10

💰 Biaya: Rp${TARIF}

🧾 ID Transaksi: ${trx}
🎫 Nomor Resi: ${resi}

Saldo Tersisa: Rp${users[chatId].saldo}`,
      { parse_mode: "Markdown" }
    );

    delete state[chatId];
  }

  // ===== EMAIL FLOW =====
  if (emailState[chatId]?.step === "email") {

    const code = Math.floor(100000 + Math.random() * 900000);
    emailState[chatId] = { step: "verify", code };

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
        to: text,
        subject: "Kode Aktivasi Titip Paket",
        text: "Kode verifikasi Anda: " + code
      });

      bot.sendMessage(chatId, "✅ Kode dikirim. Masukkan kode:");
    } catch (err) {
      console.error(err);
      delete emailState[chatId];
      bot.sendMessage(chatId, "❌ Gagal kirim email.");
    }
  }

  if (emailState[chatId]?.step === "verify") {

    if (text == emailState[chatId].code) {
      users[chatId].verified = true;
      delete emailState[chatId];
      bot.sendMessage(chatId, "✅ Email berhasil diverifikasi!");
    } else {
      bot.sendMessage(chatId, "❌ Kode salah.");
    }
  }

});
