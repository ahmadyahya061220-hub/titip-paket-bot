require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
const express = require("express");
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");

// ===== CONFIG =====
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const EMAIL_ADDRESS = process.env.EMAIL_ADDRESS;
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;
const PORT = process.env.PORT || 3000;
const TRANSAKSI_FILE = path.join(__dirname, "transaksi.json");

// ===== CHECK ENV =====
if (!BOT_TOKEN || !ADMIN_ID) {
  console.error("⚠ BOT_TOKEN atau ADMIN_ID belum di-set");
  process.exit(1);
}

// ===== INIT BOT & SERVER =====
const bot = new Telegraf(BOT_TOKEN);
const app = express();
app.get("/", (req, res) => res.send("Bot Titip Paket Aktif ✅"));
app.listen(PORT, () => console.log(`Server berjalan di port ${PORT}`));

// ===== DATA =====
let users = {};
let transaksi = [];

// ===== LOAD TRANSAKSI =====
try {
  if (!fs.existsSync(TRANSAKSI_FILE)) fs.writeFileSync(TRANSAKSI_FILE, "[]");
  transaksi = JSON.parse(fs.readFileSync(TRANSAKSI_FILE, "utf-8") || "[]");
} catch (e) {
  console.error("Error load transaksi:", e.message);
  transaksi = [];
}

// ===== HELPERS =====
function saveTransaksi() {
  try {
    fs.writeFileSync(TRANSAKSI_FILE, JSON.stringify(transaksi, null, 2));
  } catch (e) {
    console.error("Error save transaksi:", e.message);
  }
}

function hitungHarga(berat) {
  return 10000 * berat + 2000;
}

async function sendEmail(to, subject, text) {
  try {
    if (!EMAIL_ADDRESS || !EMAIL_PASSWORD || !to.includes("@")) return false;
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: EMAIL_ADDRESS, pass: EMAIL_PASSWORD },
    });
    await transporter.sendMail({ from: EMAIL_ADDRESS, to, subject, text });
    return true;
  } catch (e) {
    console.error("Email error:", e.message);
    return false;
  }
}

// ===== START + MENU =====
bot.start(async (ctx) => {
  const chatId = ctx.chat.id;
  users[chatId] = { step: 0 };
  try {
    await ctx.reply(
      "🚀 *LAYANAN TITIP PAKET*\nPilih menu di bawah untuk memulai:",
      {
        parse_mode: "Markdown",
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback("📦 Titip Paket", "titip")],
          [Markup.button.callback("📄 Riwayat Transaksi", "riwayat")],
          [Markup.button.callback("ℹ️ Info Layanan", "info")],
        ]),
      }
    );
  } catch (e) {
    console.error("Start error:", e.message);
  }
});

// ===== CALLBACK MENU =====
bot.on("callback_query", async (q) => {
  try {
    const chatId = q.message.chat.id;
    users[chatId] = users[chatId] || { step: 0 };
    switch (q.data) {
      case "titip":
        users[chatId].step = 1;
        await bot.sendMessage(chatId, "Masukkan Nama Pengirim:");
        break;
      case "riwayat":
        if (transaksi.length === 0) return bot.sendMessage(chatId, "Belum ada transaksi.");
        let msg = "📄 Riwayat 10 terakhir:\n";
        transaksi.slice(-10).forEach((t) => {
          msg += `ID:${t.id} | ${t.data.nama} → ${t.data.penerima} | ${t.data.berat}kg | Rp${t.data.total}\n`;
        });
        await bot.sendMessage(chatId, msg);
        break;
      case "info":
        await bot.sendMessage(
          chatId,
          "ℹ️ Info layanan:\n- Berat max 50kg\n- Gratis ongkir\n- Tracking realtime"
        );
        break;
    }
    await bot.answerCbQuery(q.id);
  } catch (e) {
    console.error("Callback error:", e.message);
  }
});

// ===== MESSAGE HANDLER =====
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text || "";
  users[chatId] = users[chatId] || { step: 0 };
  try {
    switch (users[chatId].step) {
      case 1:
        users[chatId].nama = text;
        users[chatId].step = 2;
        await bot.sendMessage(chatId, "Masukkan Nama Penerima:");
        break;
      case 2:
        users[chatId].penerima = text;
        users[chatId].step = 3;
        await bot.sendMessage(chatId, "Masukkan Berat (kg):");
        break;
      case 3:
        const berat = parseInt(text);
        if (isNaN(berat) || berat <= 0) return bot.sendMessage(chatId, "⚠ Berat tidak valid");
        users[chatId].berat = berat;
        users[chatId].total = hitungHarga(berat);
        users[chatId].step = 4;
        await bot.sendMessage(
          chatId,
          `📦 Konfirmasi:\nPengirim: ${users[chatId].nama}\nPenerima: ${users[chatId].penerima}\nBerat: ${berat}kg\nTotal: Rp${users[chatId].total}\nKetik *SUDAH* setelah transfer.`,
          { parse_mode: "Markdown" }
        );
        break;
      case 4:
        if (text.toUpperCase() === "SUDAH") {
          const id = "TRX" + Date.now();
          transaksi.push({ id, user: chatId, data: users[chatId] });
          saveTransaksi();
          await bot.sendMessage(
            ADMIN_ID,
            `🔔 TRANSAKSI BARU\nID:${id}\nPengirim:${users[chatId].nama}\nPenerima:${users[chatId].penerima}\nBerat:${users[chatId].berat}kg\nTotal:Rp${users[chatId].total}\nBuat resi: /resi ${id} NOMORRESI`
          );
          users[chatId] = { step: 0 };
        }
        break;
      default:
        // Ignore stiker, foto, voice, dll
        break;
    }
  } catch (e) {
    console.error("Message handler error:", e.message);
  }
});

// ===== ADMIN KIRIM RESI =====
bot.onText(/\/resi (.+) (.+)/, async (msg, match) => {
  try {
    if (msg.chat.id.toString() !== ADMIN_ID) return;
    const id = match[1],
      nomorResi = match[2];
    const trx = transaksi.find((t) => t.id === id);
    if (!trx) return bot.sendMessage(msg.chat.id, "ID tidak ditemukan.");
    await bot.sendMessage(trx.user, `✅ Resi: ${nomorResi} sudah dibuat. Terima kasih 🙏`);
    await bot.sendMessage(msg.chat.id, "Resi berhasil dikirim ke user.");
  } catch (e) {
    console.error("Admin resi error:", e.message);
  }
});

// ===== GLOBAL ERROR =====
bot.catch((err) => console.error("Bot error:", err.message));
process.on("unhandledRejection", (reason) => console.error("Unhandled Rejection:", reason));
process.on("uncaughtException", (err) => console.error("Uncaught Exception:", err.message));

// ===== LAUNCH =====
bot.launch().then(() => console.log("Bot Titip Paket berjalan ✅"));
