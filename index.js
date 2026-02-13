require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

// ----- Setup dasar -----
const app = express();
app.use(bodyParser.json());

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const PORT = process.env.PORT || 3000;
const DOMAIN = process.env.DOMAIN || `http://localhost:${PORT}`;

// ----- Database sementara di memori -----
let users = {};        // { chatId: { step, nama, penerima, berat, total, email, verified, token } }
let transaksi = [];   // { id, userChatId, data }

// ----- Setup bot Telegram dengan polling -----
const bot = new TelegramBot(BOT_TOKEN, { polling: true });
// Catatan: opsi polling: true digunakan untuk polling standar. Dokumentasi library menyebutkan
// penggunaan polling dengan options.polling; ini sesuai referensi resmi library. :contentReference[oaicite:0]{index=0}

// ----- Setup email via Nodemailer -----
const transporter = nodemailer.createTransport({
  service: "gmail", // bisa diganti provider lain
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// ----- Fungsi bantu -----
function hitungHarga(berat) {
  const hargaPerKg = 10000;
  const profit = 2000;
  return (hargaPerKg * berat) + profit;
}

function generateToken() {
  return crypto.randomBytes(16).toString("hex");
}

// ----- Express endpoint sederhana -----
app.get("/", (req, res) => {
  res.send("Bot Titip Paket Aktif ✅");
});

// Endpoint verifikasi email
app.get("/verify", (req, res) => {
  const { chatId, token } = req.query;
  if (!chatId || !token) return res.send("Link tidak valid ❌");

  const user = users[chatId];
  if (!user) return res.send("User tidak ditemukan ❌");

  if (user.token === token) {
    user.verified = true;
    user.step = 0; // reset step

    // Konfirmasi ke user di Telegram
    bot.sendMessage(chatId,
      `✅ Email berhasil diverifikasi!\nSekarang Anda bisa menggunakan menu Titip Paket.`
    );

    return res.send("Email berhasil diverifikasi ✅\nBuka Telegram untuk melanjutkan.");
  } else {
    return res.send("Token salah atau link kadaluarsa ❌");
  }
});

// ----- Bot Telegram: handler utama -----

// 1) Perintah /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  // Reset atau inisialisasi user
  if (!users[chatId]) {
    users[chatId] = { step: 0 };
  } else {
    users[chatId].step = 0;
  }

  const keyboard = [
    ["📧 Aktivasi Email"],
    ["📦 Titip Paket", "ℹ️ Bantuan"],
    ["📊 Status Pesanan"]
  ];

  bot.sendMessage(chatId,
    `🤖 *BOT TITIP PAKET USAHA*\n\nPilih menu di bawah untuk mulai.`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        keyboard,
        resize_keyboard: true
      }
    }
  );
});

// 2) Pesan masuk utama
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // Abaikan pesan yang bukan teks atau command yang sudah tertangani
  if (!text) return;

  // Jika command /start, sudah ditangani di atas
  if (text.startsWith("/start")) return;

  // Pastikan user terekam
  if (!users[chatId]) users[chatId] = { step: 0 };

  const user = users[chatId];

  // ----- Menu: Aktivasi Email -----
  if (text === "📧 Aktivasi Email") {
    user.step = "aktivasi_email";
    bot.sendMessage(chatId, "Masukkan alamat email Anda:");
    return;
  }

  if (user.step === "aktivasi_email") {
    const email = text.trim();
    // Simpan email & buat token
    const token = generateToken();
    user.email = email;
    user.verified = false;
    user.token = token;

    // Kirim email aktivasi
    const link = `${DOMAIN}/verify?chatId=${chatId}&token=${token}`;
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Aktivasi Email Bot Titip Paket",
      html: `
        <h3>Aktivasi Email</h3>
        <p>Klik link berikut untuk mengaktifkan akun Anda di Bot Titip Paket:</p>
        <a href="${link}">Aktivasi Sekarang</a>
      `
    };

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        console.error("Error kirim email:", err);
        bot.sendMessage(chatId, "❌ Gagal mengirim email. Cek kembali dan coba lagi.");
      } else {
        bot.sendMessage(chatId,
          `📧 Email aktivasi terkirim ke ${email}.\nSilakan cek inbox/spam lalu klik link aktivasi.`
        );
      }
      // setelah kirim, set step ke 0 atau tetap diaktivasi_email agar user bisa kirim ulang?
      user.step = 0;
    });

    return;
  }

  // ----- Menu: Titip Paket -----
  // Pastikan email sudah terverifikasi
  if (text === "📦 Titip Paket") {
    if (!user.email || !user.verified) {
      bot.sendMessage(chatId, "❌ Email belum terverifikasi. Silakan aktivasi email dulu.");
      return;
    }
    // Mulai flow titip paket
    user.step = 1;
    bot.sendMessage(chatId, "Masukkan Nama Pengirim:");
    return;
  }

  // Proses step-step titip paket
  // Step 1: Nama Pengirim
  if (user.step === 1) {
    user.nama = text.trim();
    user.step = 2;
    bot.sendMessage(chatId, "Masukkan Nama Penerima:");
    return;
  }

  // Step 2: Nama Penerima
  if (user.step === 2) {
    user.penerima = text.trim();
    user.step = 3;
    bot.sendMessage(chatId, "Masukkan Berat (kg):");
    return;
  }

  // Step 3: Berat
  if (user.step === 3) {
    const berat = parseInt(text);
    if (isNaN(berat) || berat <= 0) {
      return bot.sendMessage(chatId, "Berat tidak valid. Masukkan angka berat dalam kg.");
    }

    const total = hitungHarga(berat);
    user.berat = berat;
    user.total = total;
    user.step = 4;

    return bot.sendMessage(chatId,
`📦 *KONFIRMASI*

Pengirim: ${user.nama}
Penerima: ${user.penerima}
Berat: ${berat} kg

Total Bayar: Rp${total}

Silakan transfer ke:
DANA/OVO/BCA XXXXX

Setelah transfer ketik: SUDAH`,
      { parse_mode: "Markdown" });
  }

  // Step 4: Konfirmasi sudah transfer
  if (user.step === 4 && text.toUpperCase() === "SUDAH") {
    // Buat ID transaksi
    const idTransaksi = "TRX" + Date.now();

    transaksi.push({
      id: idTransaksi,
      userChatId: chatId,
      data: { ...user }
    });

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

    // Reset user step
    user.step = 0;
    return;
  }

  // Jika di step 4 tapi teks bukan SUDAH
  if (user.step === 4) {
    return bot.sendMessage(chatId, "Ketik SUDAH jika sudah transfer, atau ketik batal untuk mengulang.");
  }

  // ----- Menu: Status Pesanan -----
  if (text === "📊 Status Pesanan") {
    // Tampilkan transaksi user
    const userTrx = transaksi.filter(t => t.userChatId === chatId);
    if (userTrx.length === 0) {
      return bot.sendMessage(chatId, "Belum ada transaksi.");
    }
    // Tampilkan ringkas
    let msg = "📊 *Daftar Transaksi Anda*\n\n";
    userTrx.forEach(t => {
      msg += `ID: ${t.id}\nPengirim: ${t.data.nama}\nPenerima: ${t.data.penerima}\nBerat: ${t.data.berat} kg\nTotal: Rp${t.data.total}\n\n`;
    });
    return bot.sendMessage(chatId, msg, { parse_mode: "Markdown" });
  }

  // ----- Menu: Bantuan -----
  if (text === "ℹ️ Bantuan" || text === "Bantuan") {
    const helpMsg = `
*Cara pakai:*

1. Aktivasi email terlebih dahulu lewat 📧 Aktivasi Email.
2. Setelah email terverifikasi, pilih 📦 Titip Paket.
3. Ikuti instruksi: nama pengirim, nama penerima, berat.
4. Transfer sesuai total, lalu ketik SUDAH.
5. Tunggu admin kirim resi.
6. Cek status lewat 📊 Status Pesanan.
    `;
    return bot.sendMessage(chatId, helpMsg, { parse_mode: "Markdown" });
  }

  // Jika tidak ada kondisi yang cocok
  // Bisa beri pesan default
  // Cek apakah user sedang di proses di step selain start
  if (user.step && user.step !== 0) {
    // Biarkan alur yang ada
    return;
  } else {
    // Pesan default
    const keyboard = [
      ["📧 Aktivasi Email"],
      ["📦 Titip Paket", "ℹ️ Bantuan"],
      ["📊 Status Pesanan"]
    ];
    bot.sendMessage(chatId,
      `Pilih menu:\n📧 Aktivasi Email\n📦 Titip Paket\nℹ️ Bantuan\n📊 Status Pesanan`,
      {
        reply_markup: { keyboard, resize_keyboard: true }
      }
    );
  }

});

// ----- Admin: kirim resi -----
bot.onText(/\/resi (.+) (.+)/, (msg, match) => {
  const chatId = msg.chat.id.toString();
  if (chatId !== ADMIN_ID) return; // hanya admin

  const id = match[1];
  const nomorResi = match[2];

  const trx = transaksi.find(t => t.id === id);
  if (!trx) {
    return bot.sendMessage(chatId, "ID tidak ditemukan.");
  }

  bot.sendMessage(trx.userChatId,
`✅ *RESI SUDAH DIBUAT*

Nomor Resi:
${nomorResi}

Terima kasih 🙏`,
    { parse_mode: "Markdown" });

  bot.sendMessage(chatId, "Resi berhasil dikirim ke user.");
});

// ----- Jalankan Express -----
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
