require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const nodemailer = require("nodemailer");

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const app = express();

const ADMIN_ID = process.env.ADMIN_ID;
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => res.send("Bot Titip Paket Aktif ✅"));
app.listen(PORT, () => console.log("Server running on port " + PORT));

// ===== DATA USERS & TRANSAKSI =====
let users = {};
let transaksi = [];

// ===== HITUNG HARGA =====
function hitungHarga(berat) {
  const hargaPerKg = 10000;
  const profit = 2000;
  return (hargaPerKg * berat) + profit;
}

// ===== EMAIL HELPER =====
async function sendEmail(to, subject, text) {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_ADDRESS, pass: process.env.EMAIL_PASSWORD }
    });
    await transporter.sendMail({ from: process.env.EMAIL_ADDRESS, to, subject, text });
    return true;
  } catch (e) {
    console.error("Error kirim email:", e.message);
    return false;
  }
}

// ===== START COMMAND =====
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  users[chatId] = { step: 0 };

  bot.sendMessage(chatId,
    "🚀 *LAYANAN TITIP PAKET*\nKlik tombol 📦 Titip Paket untuk memulai",
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "📦 Titip Paket", callback_data: "titip" }],
          [{ text: "📄 Riwayat Transaksi", callback_data: "riwayat" }],
          [{ text: "ℹ️ Info Layanan", callback_data: "info" }]
        ]
      }
    }
  );
});

// ===== MENU CALLBACK =====
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  users[chatId] = users[chatId] || { step: 0 };

  try {
    if (data === "titip") {
      users[chatId].step = 1;
      await bot.sendMessage(chatId, "Masukkan Nama Pengirim:");
    } else if (data === "riwayat") {
      if (transaksi.length === 0) return bot.sendMessage(chatId, "Belum ada transaksi.");
      let msg = "📄 Riwayat 10 terakhir:\n";
      transaksi.slice(-10).forEach(t => {
        msg += `ID: ${t.id} | Pengirim: ${t.data.nama} | Penerima: ${t.data.penerima} | Berat: ${t.data.berat}kg | Total: Rp${t.data.total}\n`;
      });
      await bot.sendMessage(chatId, msg);
    } else if (data === "info") {
      await bot.sendMessage(chatId,
        "ℹ️ *INFO LAYANAN*\n- Berat max 50kg\n- Gratis ongkir di kota tertentu\n- Paket di-tracking realtime",
        { parse_mode: "Markdown" }
      );
    }
    await bot.answerCallbackQuery(query.id);
  } catch (e) {
    console.error("Error callback:", e.message);
  }
});

// ===== MESSAGE HANDLER =====
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  users[chatId] = users[chatId] || { step: 0 };

  try {
    // Langkah input paket
    switch(users[chatId].step) {
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
        if (isNaN(berat) || berat <= 0) return bot.sendMessage(chatId, "⚠ Berat tidak valid. Masukkan angka:");
        const total = hitungHarga(berat);
        users[chatId].berat = berat;
        users[chatId].total = total;
        users[chatId].step = 4;
        // Simpan email pengguna jika tersedia
        users[chatId].email = msg.from?.username ? msg.from.username + "@telegram.local" : "";
        await bot.sendMessage(chatId,
          `📦 *KONFIRMASI*\nPengirim: ${users[chatId].nama}\nPenerima: ${users[chatId].penerima}\nBerat: ${berat} kg\nTotal Bayar: Rp${total}\nSilakan transfer ke: DANA/OVO/BCA XXXXX\nSetelah transfer ketik: SUDAH`,
          { parse_mode: "Markdown" }
        );
        break;
      case 4:
        if (text.toUpperCase() === "SUDAH") {
          const idTransaksi = "TRX" + Date.now();
          transaksi.push({ id: idTransaksi, user: chatId, data: users[chatId] });

          // Kirim notifikasi ke admin
          await bot.sendMessage(ADMIN_ID,
            `🔔 TRANSAKSI BARU\nID: ${idTransaksi}\nUser: ${chatId}\nPengirim: ${users[chatId].nama}\nPenerima: ${users[chatId].penerima}\nBerat: ${users[chatId].berat} kg\nTotal: Rp${users[chatId].total}\nSetelah buat resi, kirim: /resi ${idTransaksi} NOMORRESI`
          );

          // Kirim email notifikasi ke pengguna jika email ada
          if (users[chatId].email) {
            const emailSent = await sendEmail(
              users[chatId].email,
              `Transaksi Titip Paket ${idTransaksi}`,
              `Halo ${users[chatId].nama}, transaksi Anda berhasil. ID: ${idTransaksi}, Total: Rp${users[chatId].total}`
            );
            if (emailSent) console.log("Email notifikasi terkirim ke user:", users[chatId].email);
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

// ===== ADMIN KIRIM RESI =====
bot.onText(/\/resi (.+) (.+)/, async (msg, match) => {
  if (msg.chat.id.toString() !== ADMIN_ID) return;
  const id = match[1];
  const nomorResi = match[2];
  const trx = transaksi.find(t => t.id === id);
  if (!trx) return bot.sendMessage(msg.chat.id, "ID tidak ditemukan.");
  await bot.sendMessage(trx.user, `✅ *RESI SUDAH DIBUAT*\nNomor Resi: ${nomorResi}\nTerima kasih 🙏`, { parse_mode: "Markdown" });
  await bot.sendMessage(msg.chat.id, "Resi berhasil dikirim ke user.");
});
