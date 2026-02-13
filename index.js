require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const app = express();
const PORT = process.env.PORT || 3000;

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// ----- Setup email transporter -----
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Kirim email dengan callback sukses/gagal
function kirimEmail(to, subject, html, callback) {
  transporter.sendMail({ from: process.env.EMAIL_USER, to, subject, html }, (err, info) => {
    if (err) {
      console.error("Gagal kirim email:", err);
      if (callback) callback(false);
    } else {
      console.log("Email terkirim:", info.response);
      if (callback) callback(true);
    }
  });
}

// ----- Database sementara -----
let users = {};      // { chatId: { step, nama, email, hp } }
let transaksi = [];  // { id, userChatId, data, resi }

// ----- Fungsi bantu -----
function hitungHarga(berat) {
  const hargaPerKg = 10000;
  const profit = 2000;
  return berat * hargaPerKg + profit;
}

function generateResi() {
  return "RESI" + Date.now();
}

// ----- Express server sederhana -----
app.get("/", (req, res) => {
  res.send("Bot Titip Paket Aktif ✅");
});
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// ----- Bot Telegram -----
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  if (!users[chatId]) users[chatId] = { step: 0 };

  const keyboard = [
    ["📧 Aktivasi Email"],
    ["📦 Titip Paket", "ℹ️ Bantuan"],
    ["📊 Status Pesanan"]
  ];

  bot.sendMessage(chatId,
    `🤖 *BOT TITIP PAKET USAHA*\nPilih menu untuk memulai.`,
    { parse_mode: "Markdown", reply_markup: { keyboard, resize_keyboard: true } }
  );
});

// Handler utama
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();
  if (!text) return;

  if (!users[chatId]) users[chatId] = { step: 0 };
  const user = users[chatId];

  try {
    // ----- Menu Aktivasi Email otomatis -----
    if (text === "📧 Aktivasi Email") {
      user.step = "aktivasi_email";
      return bot.sendMessage(chatId, "Masukkan email Anda:");
    }

    if (user.step === "aktivasi_email") {
      const email = text;
      user.email = email;
      user.verified = true;                  // Auto verifikasi
      user.token = crypto.randomBytes(16).toString("hex");
      user.step = 0;

      bot.sendMessage(chatId,
        `✅ Email ${email} berhasil diverifikasi otomatis!\nSekarang Anda bisa menggunakan menu Titip Paket.`
      );
      return;
    }

    // ----- Menu Titip Paket -----
    if (text === "📦 Titip Paket") {
      if (!user.email || !user.verified) {
        return bot.sendMessage(chatId, "❌ Email belum terverifikasi. Silakan aktivasi email dulu.");
      }
      user.step = 1;
      return bot.sendMessage(chatId, "Masukkan Nama Pengirim:");
    }

    // Step 1: Nama Pengirim
    if (user.step === 1) {
      user.nama = text;
      user.step = 2;
      return bot.sendMessage(chatId, "Masukkan Nomor HP Pengirim:");
    }

    // Step 2: Nomor HP
    if (user.step === 2) {
      user.hp = text;
      user.step = 3;
      return bot.sendMessage(chatId, "Masukkan Kode Toko (Indomaret):");
    }

    // Step 3: Kode Toko
    if (user.step === 3) {
      user.toko = text;
      user.step = 4;
      return bot.sendMessage(chatId, "Masukkan Berat Paket (kg, default 1kg jika kosong):");
    }

    // Step 4: Berat Paket
    if (user.step === 4) {
      let berat = parseInt(text);
      if (isNaN(berat) || berat <= 0) berat = 1; // default 1kg
      const total = hitungHarga(berat);
      const resi = generateResi();

      // Data paket otomatis
      const paket = {
        kategori: "Lain-lain",
        deskripsi: "Lain",
        hargaBarang: 10000,
        berat: berat,
        panjang: 10,
        lebar: 10,
        tinggi: 10,
        resi,
        vc: "FREEONGKIR123"
      };

      transaksi.push({ id: resi, userChatId: chatId, user, paket });

      // Kirim ke Telegram
      bot.sendMessage(chatId,
`📦 Paket Berhasil Dibuat
ID Transaksi: ${resi}
Nama Pengirim/Penerima: ${user.nama}
HP: ${user.hp}
Toko: ${user.toko}
Kategori: ${paket.kategori}
Deskripsi: ${paket.deskripsi}
Harga Barang: Rp${paket.hargaBarang}
Berat: ${paket.berat} kg
Dimensi: ${paket.panjang}x${paket.lebar}x${paket.tinggi} cm
Voucher Gratis Ongkir: ${paket.vc}
Nomor Resi: ${paket.resi}

Terima kasih 🙏`
      );

      // Kirim notifikasi ke admin
      bot.sendMessage(ADMIN_ID,
`🔔 TRANSAKSI BARU
ID: ${resi}
User: ${user.nama}
HP: ${user.hp}
Toko: ${user.toko}
Voucher: ${paket.vc}`
      );

      // Kirim email ke user dengan callback
      const emailHtml = `
<h3>Paket Anda Berhasil Dibuat</h3>
<p>ID Transaksi: ${resi}</p>
<p>Nama Pengirim/Penerima: ${user.nama}</p>
<p>HP: ${user.hp}</p>
<p>Toko: ${user.toko}</p>
<p>Kategori: ${paket.kategori}</p>
<p>Deskripsi: ${paket.deskripsi}</p>
<p>Harga Barang: Rp${paket.hargaBarang}</p>
<p>Berat: ${paket.berat} kg</p>
<p>Dimensi: ${paket.panjang}x${paket.lebar}x${paket.tinggi} cm</p>
<p>Voucher Gratis Ongkir: ${paket.vc}</p>
<p>Nomor Resi: <b>${paket.resi}</b></p>
<p>Terima kasih telah menggunakan layanan Titip Paket.</p>`;

      kirimEmail(user.email, "Konfirmasi Paket Anda", emailHtml, (success) => {
        if (success) {
          bot.sendMessage(chatId, "✅ Email konfirmasi berhasil dikirim ke inbox Anda.");
        } else {
          bot.sendMessage(chatId, "⚠ Email gagal dikirim. Silakan cek alamat email Anda.");
        }
      });

      user.step = 0;
      return;
    }

    // ----- Status Pesanan -----
    if (text === "📊 Status Pesanan") {
      const userTrx = transaksi.filter(t => t.userChatId === chatId);
      if (!userTrx.length) return bot.sendMessage(chatId, "Belum ada transaksi.");

      let msg = "📊 *Daftar Transaksi Anda*\n\n";
      userTrx.forEach(t => {
        msg += `ID: ${t.id}\nNama: ${t.user.nama}\nHP: ${t.user.hp}\nToko: ${t.user.toko}\nBerat: ${t.paket.berat} kg\nResi: ${t.paket.resi}\nVoucher: ${t.paket.vc}\n\n`;
      });

      return bot.sendMessage(chatId, msg, { parse_mode: "Markdown" });
    }

    // ----- Bantuan -----
    if (text === "ℹ️ Bantuan") {
      return bot.sendMessage(chatId,
`*Cara pakai:*
1. Aktivasi email lewat 📧 Aktivasi Email.
2. Pilih 📦 Titip Paket.
3. Masukkan Nama, HP, Kode Toko.
4. Masukkan Berat Paket (default 1kg).
5. Bot akan auto generate resi + voucher gratis ongkir.
6. Email konfirmasi akan dikirim dan bot beri notifikasi berhasil/gagal.`,
        { parse_mode: "Markdown" }
      );
    }

  } catch (err) {
    console.error("Error:", err);
    bot.sendMessage(chatId, "⚠ Terjadi kesalahan. Silakan coba lagi.");
  }
});
