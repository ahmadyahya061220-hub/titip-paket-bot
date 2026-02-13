require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const app = express();
app.use(bodyParser.json());

// Database sementara
let db = {}; // { email: { verified: true/false, token: '...' } }

// Telegram Bot
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// SMTP setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Bot command start
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, 
    `🤖 Selamat datang di BOT TITIP PAKET\n\nSilakan ketik email Anda untuk aktivasi:`
  );
});

// Terima email dari user
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const email = msg.text.trim();

  // Cek apakah sudah command /start
  if (email.startsWith('/')) return;

  // Generate token
  const token = crypto.randomBytes(16).toString('hex');
  db[email] = { verified: false, token, chatId };

  const link = `http://localhost:${process.env.PORT}/verify?email=${email}&token=${token}`;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Aktivasi Email Bot Titip Paket',
    html: `<h3>Klik link berikut untuk aktivasi:</h3><a href="${link}">Aktivasi Sekarang</a>`
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      bot.sendMessage(chatId, `❌ Gagal mengirim email. Cek email Anda dan coba lagi.`);
    } else {
      bot.sendMessage(chatId, `📧 Email aktivasi terkirim ke ${email}. Silakan cek inbox/spam.`);
    }
  });
});

// Express endpoint verifikasi
app.get('/verify', (req, res) => {
  const { email, token } = req.query;
  if (!email || !token) return res.send('Link tidak valid');

  if (db[email] && db[email].token === token) {
    db[email].verified = true;

    // Kirim pesan ke Telegram user
    const chatId = db[email].chatId;
    bot.sendMessage(chatId, `✅ Email ${email} berhasil diverifikasi!\nSekarang Anda bisa menggunakan menu Titip Paket.`);

    res.send('Email berhasil diverifikasi ✅\nBuka Telegram untuk melanjutkan.');
  } else {
    res.send('Token salah atau email tidak terdaftar ❌');
  }
});

// Menu Titip Paket sederhana
bot.onText(/titip paket/i, (msg) => {
  const chatId = msg.chat.id;
  // Cek apakah email user sudah diverifikasi
  const emailUser = Object.keys(db).find(e => db[e].chatId === chatId);
  if (!emailUser || !db[emailUser].verified) {
    bot.sendMessage
