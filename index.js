require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Database sementara
let users = {};      // { chatId: { step, nama, penerima, berat, total, email, verified } }
let transaksi = [];  // { id, userChatId, data }

// Fungsi menghitung harga
function hitungHarga(berat) {
  const hargaPerKg = 10000;
  const profit = 2000;
  return berat * hargaPerKg + profit;
}

// ----- Express server sederhana -----
app.get("/", (req, res) => {
  res.send("Bot Titip Paket Aktif ✅");
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// ----- Bot Telegram -----
// /start
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
    return bot.sendMessage(chatId,
      `✅ Email ${email} berhasil diverifikasi otomatis!\nSekarang Anda bisa menggunakan menu Titip Paket.`
    );
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
    return bot.sendMessage(chatId, "Masukkan Nama Penerima:");
  }

  // Step 2: Nama Penerima
  if (user.step === 2) {
    user.penerima = text;
    user.step = 3;
    return bot.sendMessage(chatId, "Masukkan Berat (kg):");
  }

  // Step 3: Berat
  if (user.step === 3) {
    const berat = parseInt(text);
    if (isNaN(berat) || berat <= 0) return bot.sendMessage(chatId, "Berat tidak valid. Masukkan angka kg.");
    const total = hitungHarga(berat);

    user.berat = berat;
    user.total = total;
    user.step = 4;

    return bot.sendMessage(chatId,
`📦 *KONFIRMASI*

Pengirim: ${user.nama}
Penerima: ${user.penerima}
Berat: ${user.berat} kg
Total Bayar: Rp${user.total}

Silakan transfer ke:
DANA/OVO/BCA XXXXX

Setelah transfer ketik: SUDAH`,
      { parse_mode: "Markdown" }
    );
  }

  // Step 4: Konfirmasi transfer
  if (user.step === 4 && text.toUpperCase() === "SUDAH") {
    const idTransaksi = "TRX" + Date.now();
    transaksi.push({ id: idTransaksi, userChatId: chatId, data: { ...user } });

    bot.sendMessage(chatId,
`⏳ Pembayaran diterima.
Admin sedang memproses.
ID Transaksi: ${idTransaksi}`
    );

    // Notifikasi ke admin
    bot.sendMessage(ADMIN_ID,
`🔔 TRANSAKSI BARU

ID: ${idTransaksi}
User: ${chatId}
Pengirim: ${user.nama}
Penerima: ${user.penerima}
Berat: ${user.berat} kg
Total: Rp${user.total}

Setelah buat resi, kirim:
/resi ${idTransaksi} NOMORRESI`
    );

    user.step = 0;
    return;
  }

  if (user.step === 4) {
    return bot.sendMessage(chatId, "Ketik SUDAH jika sudah transfer.");
  }

  // ----- Menu Status Pesanan -----
  if (text === "📊 Status Pesanan") {
    const userTrx = transaksi.filter(t => t.userChatId === chatId);
    if (!userTrx.length) return bot.sendMessage(chatId, "Belum ada transaksi.");

    let msg = "📊 *Daftar Transaksi Anda*\n\n";
    userTrx.forEach(t => {
      msg += `ID: ${t.id}\nPengirim: ${t.data.nama}\nPenerima: ${t.data.penerima}\nBerat: ${t.data.berat} kg\nTotal: Rp${t.data.total}\n\n`;
    });

    return bot.sendMessage(chatId, msg, { parse_mode: "Markdown" });
  }

  // ----- Menu Bantuan -----
  if (text === "ℹ️ Bantuan") {
    return bot.sendMessage(chatId,
`*Cara pakai:*
1. Aktivasi email lewat 📧 Aktivasi Email.
2. Pilih 📦 Titip Paket.
3. Ikuti instruksi: Nama Pengirim, Nama Penerima, Berat.
4. Transfer sesuai total, lalu ketik SUDAH.
5. Tunggu admin kirim resi.
6. Cek status lewat 📊 Status Pesanan.`,
      { parse_mode: "Markdown" }
    );
  }

  // Pesan default
  const keyboard = [
    ["📧 Aktivasi Email"],
    ["📦 Titip Paket", "ℹ️ Bantuan"],
    ["📊 Status Pesanan"]
  ];
  bot.sendMessage(chatId, "Pilih menu:", { reply_markup: { keyboard, resize_keyboard: true } });
});

// ----- Admin kirim resi -----
bot.onText(/\/resi (.+) (.+)/, (msg, match) => {
  const chatId = msg.chat.id.toString();
  if (chatId !== ADMIN_ID) return;

  const id = match[1];
  const nomorResi = match[2];

  const trx = transaksi.find(t => t.id === id);
  if (!trx) return bot.sendMessage(chatId, "ID tidak ditemukan.");

  bot.sendMessage(trx.userChatId,
`✅ *RESI SUDAH DIBUAT*
Nomor Resi: ${nomorResi}
Terima kasih 🙏`,
    { parse_mode: "Markdown" }
  );

  bot.sendMessage(chatId, "Resi berhasil dikirim ke user.");
});
