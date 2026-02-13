
require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
const express = require("express");
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");

// ===== CONFIG =====
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const EMAIL_ADDRESS = process.env.EMAIL_ADDRESS;
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;
const PORT = process.env.PORT || 3000;
const TRANSAKSI_FILE = path.join(__dirname, "transaksi.json");
const MAX_RETRY = 3;
const RETRY_DELAY = 2000;

// ===== CHECK ENV =====
if (!BOT_TOKEN || !ADMIN_ID || !EMAIL_ADDRESS || !EMAIL_PASSWORD) {
  console.error("⚠ Pastikan BOT_TOKEN, ADMIN_ID, EMAIL_ADDRESS, EMAIL_PASSWORD sudah di-set!");
  process.exit(1);
}

// ===== INIT BOT & EXPRESS =====
const bot = new Telegraf(BOT_TOKEN);
const app = express();
app.get("/", (req, res) => res.send("Bot Titip Paket Aktif ✅"));
app.listen(PORT, () => console.log("Server berjalan di port " + PORT));

// ===== DATA =====
let users = {};
let transaksi = [];

// Load transaksi dari file
try {
  if (!fs.existsSync(TRANSAKSI_FILE)) fs.writeFileSync(TRANSAKSI_FILE, "[]");
  transaksi = JSON.parse(fs.readFileSync(TRANSAKSI_FILE, "utf-8") || "[]");
} catch (e) {
  console.error("Error load transaksi file:", e.message);
  transaksi = [];
}

// ===== HELPERS =====
function saveTransaksi() {
  try { fs.writeFileSync(TRANSAKSI_FILE, JSON.stringify(transaksi, null, 2)); }
  catch (e) { console.error("Error save transaksi:", e.message); }
}
function hitungHarga(berat) { return (10000 * berat) + 2000; }
function generateResi() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 10 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
}

// ===== EMAIL HELPER =====
async function sendEmail(to, subject, text) {
  try {
    if (!to.includes("@")) return false; // email invalid
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
  } catch (err) { console.error("Global error email:", err.message); return false; }
}

// ===== START COMMAND =====
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
  } catch (e) { console.error("Error start:", e.message); }
});

// ===== CALLBACK MENU =====
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  users[chatId] = users[chatId] || { step: 0 };
  try {
    switch (query.data) {
      case "titip": users[chatId].step = 1; await bot.sendMessage(chatId, "Masukkan Nama Pengirim:"); break;
      case "riwayat":
        if (transaksi.length === 0) return bot.sendMessage(chatId, "Belum ada transaksi.");
        let msg = "📄 Riwayat 10 terakhir:\n";
        transaksi.slice(-10).forEach(t => {
          msg += `ID: ${t.id} | Pengirim: ${t.data.nama} | Penerima: ${t.data.penerima} | Berat: ${t.data.berat}kg | Total: Rp${t.data.total}\n`;
        });
        await bot.sendMessage(chatId, msg);
        break;
      case "info": await bot.sendMessage(chatId, "ℹ️ Info layanan: Berat max 50kg, Gratis ongkir, Tracking realtime"); break;
    }
    await bot.answerCbQuery(query.id);
  } catch (e) { console.error("Error callback:", e.message); }
});

// ===== MESSAGE HANDLER =====
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  users[chatId] = users[chatId] || { step: 0 };
  try {
    switch(users[chatId].step) {
      case 1: users[chatId].nama = text; users[chatId].step = 2; await bot.sendMessage(chatId, "Masukkan Nama Penerima:"); break;
      case 2: users[chatId].penerima = text; users[chatId].step = 3; await bot.sendMessage(chatId, "Masukkan Berat (kg):"); break;
      case 3:
        const berat = parseInt(text);
        if (isNaN(berat) || berat <= 0) return bot.sendMessage(chatId, "⚠ Berat tidak valid.");
        users[chatId].berat = berat;
        users[chatId].total = hitungHarga(berat);
        users[chatId].email = msg.from?.username ? msg.from.username + "@telegram.local" : "";
        users[chatId].step = 4;
        await bot.sendMessage(chatId, `📦 Konfirmasi: Pengirim ${users[chatId].nama}, Penerima ${users[chatId].penerima}, Berat ${berat} kg, Total Rp${users[chatId].total}\nKetik SUDAH setelah transfer.`);
        break;
      case 4:
        if (text.toUpperCase() === "SUDAH") {
          const idTransaksi = "TRX" + Date.now();
          transaksi.push({ id: idTransaksi, user: chatId, data: users[chatId] });
          saveTransaksi();
          await bot.sendMessage(ADMIN_ID, `🔔 TRANSAKSI BARU\nID: ${idTransaksi}\nPengirim: ${users[chatId].nama}, Penerima: ${users[chatId].penerima}, Berat: ${users[chatId].berat}kg, Total: Rp${users[chatId].total}\nBuat resi: /resi ${idTransaksi} NOMORRESI`);
          if (users[chatId].email) await sendEmail(users[chatId].email, `Transaksi ${idTransaksi}`, `Transaksi berhasil. Total: Rp${users[chatId].total}`);
          await bot.sendMessage(chatId, `⏳ Pembayaran diterima. ID Transaksi: ${idTransaksi}`);
          users[chatId] = { step: 0 };
        }
        break;
    }
  } catch (e) { console.error("Error message handler:", e.message); }
});

// ===== ADMIN KIRIM RESI =====
bot.onText(/\/resi (.+) (.+)/, async (msg, match) => {
  if (msg.chat.id.toString() !== ADMIN_ID) return;
  const id = match[1], nomorResi = match[2];
  const trx = transaksi.find(t => t.id === id);
  if (!trx) return bot.sendMessage(msg.chat.id, "ID tidak ditemukan.");
  await bot.sendMessage(trx.user, `✅ Resi: ${nomorResi} sudah dibuat. Terima kasih 🙏`);
  await bot.sendMessage(msg.chat.id, "Resi berhasil dikirim ke user.");
});

// ===== GLOBAL ERROR HANDLER =====
bot.catch((err) => console.error("Bot error:", err.message));
process.on("unhandledRejection", (reason) => console.error("Unhandled Rejection:", reason));
process.on("uncaughtException", (err) => console.error("Uncaught Exception:", err.message));

// ===== LAUNCH =====
bot.launch().then(() => console.log("Bot Titip Paket berjalan ✅"));
