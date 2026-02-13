require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
const express = require("express");
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const EMAIL_ADDRESS = process.env.EMAIL_ADDRESS;
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;
const PORT = process.env.PORT || 3000;
const TRANSAKSI_FILE = path.join(__dirname, "transaksi.json");

// Minimal check env
if (!BOT_TOKEN || !ADMIN_ID) {
  console.error("⚠ BOT_TOKEN atau ADMIN_ID belum di-set. Exit.");
  process.exit(1);
}

// Init bot & express
const bot = new Telegraf(BOT_TOKEN);
const app = express();
app.get("/", (req, res) => res.send("Bot Titip Paket Aktif ✅"));
app.listen(PORT, () => console.log("Server berjalan di port " + PORT));

// Data storage
let users = {};
let transaksi = [];
try {
  if (!fs.existsSync(TRANSAKSI_FILE)) fs.writeFileSync(TRANSAKSI_FILE, "[]");
  transaksi = JSON.parse(fs.readFileSync(TRANSAKSI_FILE, "utf-8") || "[]");
} catch (e) { console.error("Error load file:", e.message); transaksi = []; }

// Save transaksi dengan try-catch
function saveTransaksi() {
  try { fs.writeFileSync(TRANSAKSI_FILE, JSON.stringify(transaksi, null, 2)); }
  catch(e) { console.error("Error save file:", e.message); }
}

// Email helper aman
async function sendEmail(to, subject, text) {
  if (!EMAIL_ADDRESS || !EMAIL_PASSWORD) return false;
  if (!to.includes("@")) return false;
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: EMAIL_ADDRESS, pass: EMAIL_PASSWORD }
    });
    try { await transporter.sendMail({ from: EMAIL_ADDRESS, to, subject, text }); return true; }
    catch(e) { console.error("Email gagal:", e.message); return false; }
  } catch(e) { console.error("Email global error:", e.message); return false; }
}

// Hitung harga
function hitungHarga(berat) { return (10000*berat)+2000; }

// Start
bot.start(async (ctx) => {
  try {
    users[ctx.chat.id] = { step: 0 };
    await ctx.reply("🚀 Layanan Titip Paket", {
      reply_markup: Markup.inlineKeyboard([[Markup.button.callback("📦 Titip Paket","titip")]])
    });
  } catch(e){ console.error("Start error:", e.message);}
});

// Callback
bot.on("callback_query", async (q) => {
  try{
    const chatId = q.message.chat.id;
    users[chatId] = users[chatId] || { step:0 };
    if(q.data==="titip"){ users[chatId].step=1; await bot.sendMessage(chatId,"Masukkan Nama Pengirim:"); }
    await bot.answerCbQuery(q.id);
  } catch(e){ console.error("Callback error:",e.message);}
});

// Message handler aman
bot.on("message", async (msg)=>{
  const chatId=msg.chat.id;
  const text=msg.text;
  users[chatId]=users[chatId]||{step:0};
  try{
    switch(users[chatId].step){
      case 1: users[chatId].nama=text; users[chatId].step=2; await bot.sendMessage(chatId,"Masukkan Nama Penerima:"); break;
      case 2: users[chatId].penerima=text; users[chatId].step=3; await bot.sendMessage(chatId,"Masukkan Berat (kg):"); break;
      case 3:
        const berat=parseInt(text); if(isNaN(berat)||berat<=0) return bot.sendMessage(chatId,"⚠ Berat tidak valid");
        users[chatId].berat=berat; users[chatId].total=hitungHarga(berat); users[chatId].step=4;
        await bot.sendMessage(chatId,`Konfirmasi: ${users[chatId].nama} → ${users[chatId].penerima}, Berat: ${berat}kg, Total: Rp${users[chatId].total}\nKetik SUDAH jika transfer.`);
        break;
      case 4:
        if(text.toUpperCase()==="SUDAH"){
          const id="TRX"+Date.now();
          transaksi.push({id,user:chatId,data:users[chatId]});
          saveTransaksi();
          await bot.sendMessage(ADMIN_ID,`Transaksi baru ID:${id}, Pengirim:${users[chatId].nama}, Penerima:${users[chatId].penerima}`);
          users[chatId]={step:0};
        }
        break;
    }
  } catch(e){ console.error("Message handler error:",e.message);}
});

// Global handler
bot.catch(err=>console.error("Bot error:",err.message));
process.on("unhandledRejection",reason=>console.error("Unhandled Rejection:",reason));
process.on("uncaughtException",err=>console.error("Uncaught Exception:",err.message));

bot.launch().then(()=>console.log("Bot berjalan ✅"));
