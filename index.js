require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const app = express();
const PORT = process.env.PORT || 3000;

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const VC_CODE = process.env.VC_CODE;

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// ----- Setup email transporter (ProtonMail Bridge / SMTP fleksibel) -----
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: parseInt(process.env.SMTP_PORT) === 465, // SSL
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Verifikasi koneksi SMTP
transporter.verify((err, success) => {
  if (err) console.error("SMTP Error:", err);
  else console.log("SMTP siap kirim email");
});

// ----- Fungsi kirim email dengan retry 3x -----
function kirimEmailWithRetry(to, subject, html, retries = 2, callback) {
  transporter.sendMail({ from: process.env.SMTP_USER, to, subject, html }, (err, info) => {
    if (err) {
      console.error("Gagal kirim email:", err);
      if (retries > 0) {
        console.log(`Mencoba kirim ulang, sisa percobaan: ${retries}`);
        return kirimEmailWithRetry(to, subject, html, retries - 1, callback);
      }
      if (callback) callback(false);
    } else {
      console.log("Email terkirim:", info.response);
      if (callback) callback(true);
    }
  });
}

// ----- Database sementara -----
let users = {};      // { chatId: { step, nama, email, hp, toko, verified } }
let transaksi = [];  // { id, userChatId, user, paket }

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
app.get("/", (req, res) => res.send("Bot Titip Paket Aktif ✅"));
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
    `🤖 *BOT TITIP PAKET*\nPilih menu untuk memulai.`,
    { parse_mode: "Markdown", reply_markup: { keyboard, resize_keyboard: true } }
  );
});

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();
  if (!text) return;

  if (!users[chatId]) users[chatId] = { step: 0 };
  const user = users[chatId];

  try {
    // ----- Aktivasi Email Realtime -----
    if (text === "📧 Aktivasi Email") {
      user.step = "aktivasi_email";
      return bot.sendMessage(chatId, "Masukkan email Anda:");
    }

    if (user.step === "aktivasi_email") {
      const email = text;
      user.email = email;

      const subject = "Aktivasi Email Bot Titip Paket";
      const html = `
        <h3>Email Anda Berhasil Diverifikasi!</h3>
        <p>Email <b>${email}</b> sudah terhubung dengan bot Titip Paket.</p>
        <p>Sekarang Anda bisa menggunakan semua fitur bot termasuk Titip Paket dan nomor resi otomatis.</p>
      `;

      kirimEmailWithRetry(email, subject, html, 2, (success) => {
        if (success) {
          user.verified = true;
          user.token = crypto.randomBytes(16).toString("hex");
          user.step = 0;
          bot.sendMessage(chatId, `✅ Email ${email} berhasil diverifikasi dan sudah masuk inbox Anda.`);
        } else {
          user.step = 0;
          bot.sendMessage(chatId, `⚠ Email ${email} gagal dikirim setelah 3 percobaan. Silakan cek alamat email Anda.`);
        }
      });
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

    if (user.step === 1) {
      user.nama = text;
      user.step = 2;
      return bot.sendMessage(chatId, "Masukkan Nomor HP Pengirim:");
    }

    if (user.step === 2) {
      user.hp = text;
      user.step = 3;
      return bot.sendMessage(chatId, "Masukkan Kode Toko (Indomaret):");
    }

    if (user.step === 3) {
      user.toko = text;
      user.step = 4;
      return bot.sendMessage(chatId, "Masukkan Berat Paket (kg, default 1kg jika kosong):");
    }

    if (user.step === 4) {
      let berat = parseInt(text);
      if (isNaN(berat) || berat <= 0) berat = 1;
      const total = hitungHarga(berat);
      const resi = generateResi();

      const paket = {
        kategori: "Lain-lain",
        deskripsi: "Lain",
        hargaBarang: 10000,
        berat: berat,
        panjang: 10,
        lebar: 10,
        tinggi: 10,
        resi,
        vc: VC_CODE
      };

      transaksi.push({ id: resi, userChatId: chatId, user, paket });

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

      bot.sendMessage(ADMIN_ID,
`🔔 TRANSAKSI BARU
ID: ${resi}
User: ${user.nama}
HP: ${user.hp}
Toko: ${user.toko}
Voucher: ${paket.vc}`
      );

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

      kirimEmailWithRetry(user.email, "Konfirmasi Paket Anda", emailHtml, 2, (success) => {
        if (success) {
          bot.sendMessage(chatId, "✅ Email konfirmasi berhasil dikirim ke inbox Anda.");
        } else {
          bot.sendMessage(chatId, "⚠ Email gagal dikirim setelah 3 percobaan. Silakan cek alamat email Anda.");
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
1. Aktivasi email lewat 📧 Aktivasi Email (langsung masuk inbox, retry 3x jika gagal).
2. Pilih 📦 Titip Paket.
3. Masukkan Nama, HP, Kode Toko.
4. Masukkan Berat Paket (default 1kg).
5. Bot akan auto generate resi + voucher gratis ongkir.
6. Email konfirmasi dikirim dan bot beri notifikasi berhasil/gagal.`,
        { parse_mode: "Markdown" }
      );
    }

  } catch (err) {
    console.error("Error:", err);
    user.step = 0; // Reset step jika error
    bot.sendMessage(chatId, "⚠ Terjadi kesalahan. Silakan coba lagi.");
  }
});
