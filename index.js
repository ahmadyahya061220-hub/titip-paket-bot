require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const nodemailer = require("nodemailer");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const VC_CODE = process.env.VC_CODE;

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Setup email
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

function kirimEmail(to, subject, html) {
  transporter.sendMail({ from: process.env.EMAIL_USER, to, subject, html }, (err, info) => {
    if (err) console.error("Gagal kirim email:", err);
  });
}

// Data sementara
let users = {};   // { chatId: { step, nama, email, hp, toko } }
let transaksi = [];

// Server express
app.get("/", (req, res) => {
  res.send("Bot Titip Paket Aktif ✅");
});
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// ----- Bot Telegram -----
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  if (!users[chatId]) users[chatId] = { step: 0 };

  const keyboard = [
    ["📝 Input Data Pengirim"],
    ["📦 Titip Paket", "ℹ️ Bantuan"]
  ];

  bot.sendMessage(chatId,
    `🤖 Bot Titip Paket Usaha\nPilih menu untuk memulai`,
    { parse_mode: "Markdown", reply_markup: { keyboard, resize_keyboard: true } }
  );
});

bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();
  if (!text) return;

  if (!users[chatId]) users[chatId] = { step: 0 };
  const user = users[chatId];

  // Input Data Pengirim
  if (text === "📝 Input Data Pengirim") {
    user.step = "nama";
    return bot.sendMessage(chatId, "Masukkan Nama Pengirim:");
  }

  if (user.step === "nama") {
    user.nama = text;
    user.step = "email";
    return bot.sendMessage(chatId, "Masukkan Email Pengirim:");
  }

  if (user.step === "email") {
    user.email = text;
    user.step = "hp";
    return bot.sendMessage(chatId, "Masukkan Nomor HP Pengirim:");
  }

  if (user.step === "hp") {
    user.hp = text;
    user.step = "toko";
    return bot.sendMessage(chatId, "Masukkan Kode Toko Indomaret:");
  }

  if (user.step === "toko") {
    user.toko = text;
    user.step = 0;

    // Kirim konfirmasi ke Telegram dan Email
    const msgKonfirmasi = 
`✅ Data Pengirim & Penerima
Nama: ${user.nama}
Email: ${user.email}
HP: ${user.hp}
Toko: ${user.toko}

Data Penerima otomatis sama dengan pengirim.`;

    bot.sendMessage(chatId, msgKonfirmasi);

    const emailHtml = `<h3>Data Pengirim & Penerima</h3>
<p>Nama: ${user.nama}</p>
<p>Email: ${user.email}</p>
<p>HP: ${user.hp}</p>
<p>Toko: ${user.toko}</p>
<p>Data penerima otomatis sama dengan pengirim.</p>`;

    kirimEmail(user.email, "Data Titip Paket Anda", emailHtml);
    return;
  }

  // Titip Paket
  if (text === "📦 Titip Paket") {
    if (!user.nama || !user.email || !user.hp || !user.toko) {
      return bot.sendMessage(chatId, "❌ Silakan input data pengirim dulu lewat 📝 Input Data Pengirim.");
    }

    // Data paket otomatis
    const paket = {
      kategori: "Lain-lain",
      deskripsi: "Lain",
      hargaBarang: 10000,
      berat: 1,
      panjang: 10,
      lebar: 10,
      tinggi: 10,
      vc: VC_CODE
    };

    const idTransaksi = "TRX" + Date.now();
    transaksi.push({ id: idTransaksi, chatId, user, paket });

    // Kirim info ke Telegram
    const msgPaket = 
`📦 Paket Berhasil Dibuat
ID Transaksi: ${idTransaksi}
Nama Pengirim/Penerima: ${user.nama}
Toko: ${user.toko}
Kategori: ${paket.kategori}
Deskripsi: ${paket.deskripsi}
Harga Barang: Rp${paket.hargaBarang}
Berat: ${paket.berat} kg
Dimensi: ${paket.panjang}x${paket.lebar}x${paket.tinggi} cm
Voucher Gratis Ongkir: ${paket.vc}

Terima kasih 🙏`;

    bot.sendMessage(chatId, msgPaket);

    // Kirim notifikasi ke admin
    bot.sendMessage(ADMIN_ID, `🔔 TRANSAKSI BARU\nID: ${idTransaksi}\nUser: ${user.nama}\nToko: ${user.toko}\nVoucher: ${paket.vc}`);

    // Kirim email ke user
    const emailHtml = `
<h3>Paket Anda Berhasil Dibuat</h3>
<p>ID Transaksi: ${idTransaksi}</p>
<p>Nama Pengirim/Penerima: ${user.nama}</p>
<p>Toko: ${user.toko}</p>
<p>Kategori: ${paket.kategori}</p>
<p>Deskripsi: ${paket.deskripsi}</p>
<p>Harga Barang: Rp${paket.hargaBarang}</p>
<p>Berat: ${paket.berat} kg</p>
<p>Dimensi: ${paket.panjang}x${paket.lebar}x${paket.tinggi} cm</p>
<p>Voucher Gratis Ongkir: ${paket.vc}</p>
<p>Terima kasih telah menggunakan layanan Titip Paket.</p>`;

    kirimEmail(user.email, "Konfirmasi Paket Anda", emailHtml);
    return;
  }

  // Bantuan
  if (text === "ℹ️ Bantuan") {
    return bot.sendMessage(chatId,
`*Cara pakai:*
1. Input data pengirim lewat 📝 Input Data Pengirim.
2. Data penerima otomatis sama dengan pengirim.
3. Pilih toko Indomaret.
4. Pilih 📦 Titip Paket untuk buat paket otomatis.
5. Bot akan kirim info paket + voucher gratis ongkir ke Telegram & Email.`,
      { parse_mode: "Markdown" }
    );
  }
});
