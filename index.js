
require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
const express = require("express");
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");

// ====== CONFIG ======
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const EMAIL_ADDRESS = process.env.EMAIL_ADDRESS;
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;
const PORT = process.env.PORT || 3000;
const MAX_RETRY = 3;
const RETRY_DELAY = 2000;
const TRANSAKSI_FILE = path.join(__dirname, "transaksi.json");

if (!BOT_TOKEN || !ADMIN_ID || !EMAIL_ADDRESS || !EMAIL_PASSWORD) {
  console.error("⚠ Pastikan semua environment variables BOT_TOKEN, ADMIN_ID, EMAIL_ADDRESS, EMAIL_PASSWORD diatur!");
  process.exit(1);
}

// ====== INIT BOT & EXPRESS ======
const bot = new Telegraf(BOT_TOKEN);
const app = express();

// ====== EXPRESS SERVER ======
app.get("/", (req, res) => res.send("Bot Titip Paket Aktif ✅"));
app.listen(PORT, () => console.log("Server running on port " + PORT));

// ====== DATA STORAGE ======
let users = {}; // session per chat
let transaksi = []; // semua transaksi
// load file transaksi jika ada
try {
  if (fs.existsSync(TRANSAKSI_FILE)) {
    transaksi = JSON.parse(fs.readFileSync(TRANSAKSI_FILE, "utf-8"));
  }
} catch (e) {
  console.error("Error load transaksi file:", e.message);
}

// ====== HELPERS ======
function saveTransaksi() {
  try {
    fs.writeFileSync(TRANSAKSI_FILE, JSON.stringify(transaksi, null, 2));
  } catch (e) {
    console.error("Error save transaksi:", e.message);
  }
}

function hitungHarga(berat) {
  const hargaPerKg = 10000;
  const profit = 2000;
  return (hargaPerKg * berat) + profit;
}

function generateResi() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 10 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
}

// ====== EMAIL HELPER ======
async function sendEmail(to, subject, text) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: EMAIL_ADDRESS, pass: EMAIL_PASSWORD }
    });

    for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
      try {
        await transporter.sendMail({ from: EMAIL_ADDRESS, to, subject, text });
        return true;
      } catch (e) {
        console.error(`Attempt ${attempt} kirim email gagal: ${e.message}`);
        await new Promise(res => setTimeout(res, RETRY_DELAY));
      }
    }
    return false;
  } catch (err) {
    console.error("Error global email:", err.message);
    return false;
  }
}

// ====== START COMMAND ======
bot.start(async (ctx) => {
  const chatId = ctx.chat.id;
  users[chatId] = { step: 0 };
  try {
    await ctx.reply(
      "🚀 *LAYANAN TITIP PAKET*\nKlik tombol 📦 Titip Paket untuk memulai",
      {
        parse_mode: "Markdown",
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback("📦 Titip Paket", "titip")],
          [Markup.button.callback("📄 Riwayat Transaksi", "riwayat")],
          [Markup.button.callback("ℹ️ Info Layanan", "info")]
        ])
      }
    );
  } catch (e) {
    console.error("Error start:", e.message);
  }
});

// ====== CALLBACK MENU ======
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  users[chatId] = users[chatId] || { step: 0 };

  try {
    if (query.data === "titip") {
      users[chatId].step = 1;
      await bot.sendMessage(chatId, "Masukkan Nama Pengirim:");
    } else if (query.data === "riwayat") {
      if (transaksi.length === 0) return bot.sendMessage(chatId, "Belum ada transaksi.");
      let msg = "📄 Riwayat 10 terakhir:\n";
      transaksi.slice(-10).forEach(t => {
        msg += `ID: ${t.id} | Pengirim: ${t.data.nama} | Penerima: ${t.data.penerima} | Berat: ${t.data.berat}kg | Total: Rp${t.data.total}\n`;
      });
      await bot.sendMessage(chatId, msg);
    } else if (query.data === "info") {
      await bot.sendMessage(chatId,
        "ℹ️ *INFO LAYANAN*\n- Berat max 50kg\n- Gratis ongkir di kota tertentu\n- Paket di-tracking realtime",
        { parse_mode: "Markdown" }
      );
    }
    await bot.answerCbQuery(query.id);
  } catch (e) {
    console.error("Error callback:", e.message);
  }
});

// ====== MESSAGE HANDLER ======
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  users[chatId] = users[chatId] || { step: 0 };

  try {
    switch (users[chatId].step) {
      case 1: // Nama Pengirim
        users[chatId].nama = text;
        users[chatId].step = 2;
        await bot.sendMessage(chatId, "Masukkan Nama Penerima:");
        break;
      case 2: // Nama Penerima
        users[chatId].penerima = text;
        users[chatId].step = 3;
        await bot.sendMessage(chatId, "Masukkan Berat (kg):");
        break;
      case 3: // Berat
        const berat = parseInt(text);
        if (isNaN(berat) || berat <= 0) return bot.sendMessage(chatId, "⚠ Berat tidak valid. Masukkan angka:");
        const total = hitungHarga(berat);
        users[chatId].berat = berat;
        users[chatId].total = total;
        // simpan email user jika ada username
        users[chatId].email = msg.from?.username ? msg.from.username + "@telegram.local" : "";
        users[chatId].step = 4;
        await bot.sendMessage(chatId,
          `📦 *KONFIRMASI*\nPengirim: ${users[chatId].nama}\nPenerima: ${users[chatId].penerima}\nBerat: ${berat} kg\nTotal Bayar: Rp${total}\nSilakan transfer ke: DANA/OVO/BCA XXXXX\nSetelah transfer ketik: SUDAH`,
          { parse_mode: "Markdown" }
        );
        break;
      case 4: // Konfirmasi SUDAH
        if (text.toUpperCase() === "SUDAH") {
          const idTransaksi = "TRX" + Date.now();
          transaksi.push({ id: idTransaksi, user: chatId, data: users[chatId] });
          saveTransaksi();

          // notifikasi admin
          await bot.sendMessage(ADMIN_ID,
            `🔔 TRANSAKSI BARU\nID: ${idTransaksi}\nUser: ${chatId}\nPengirim: ${users[chatId].nama}\nPenerima: ${users[chatId].penerima}\nBerat: ${users[chatId].berat} kg\nTotal: Rp${users[chatId].total}\nSetelah buat resi, kirim: /resi ${idTransaksi} NOMORRESI`
          );

          // email notifikasi user
          if (users[chatId].email) {
            const emailSent = await sendEmail(
              users[chatId].email,
              `Transaksi Titip Paket ${idTransaksi}`,
              `Halo ${users[chatId].nama}, transaksi Anda berhasil. ID: ${idTransaksi}, Total: Rp${users[chatId].total}`
            );
            if (emailSent) console.log("Email notifikasi terkirim:", users[chatId].email);
          }

          await bot.sendMessage(chatId, `⏳ Pembayaran diterima. Admin sedang memproses.\nID Transaksi: ${idTransaksi}`);
          users[chatId] = { step: 0 };
        }
        break;
      default:
        break;
    }
  } catch (e) {
    console.error("Error message handler:", e.message);
  }
});

// ====== ADMIN KIRIM RESI ======
bot.onText(/\/resi (.+) (.+)/, async (msg, match) => {
  if (msg.chat.id.toString() !== ADMIN_ID) return;
  const id = match[1];
  const nomorResi = match[2];
  const trx = transaksi.find(t => t.id === id);
  if (!trx) return bot.sendMessage(msg.chat.id, "ID tidak ditemukan.");
  await bot.sendMessage(trx.user, `✅ *RESI SUDAH DIBUAT*\nNomor Resi: ${nomorResi}\nTerima kasih 🙏`, { parse_mode: "Markdown" });
  await bot.sendMessage(msg.chat.id, "Resi berhasil dikirim ke user.");
});

// ====== GLOBAL ERROR HANDLING ======
bot.catch((err) => console.error("Bot global error:", err.message));
process.on("unhandledRejection", (reason) => console.error("Unhandled Rejection:", reason));
process.on("uncaughtException", (err) => console.error("Uncaught Exception:", err.message));

// ====== LAUNCH BOT ======
bot.launch().then(() => console.log("Bot Titip Paket berjalan ✅"));
