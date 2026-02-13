require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const app = express();
app.use(bodyParser.json());

let db = {}; // Simpel database sementara (email: status)

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Endpoint input email
app.post('/register', (req, res) => {
  const email = req.body.email;
  if (!email) return res.status(400).send('Email wajib diisi');

  const token = crypto.randomBytes(16).toString('hex');
  db[email] = { verified: false, token };

  const link = `http://localhost:${process.env.PORT}/verify?email=${email}&token=${token}`;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Aktivasi Email Bot Titip Paket',
    html: `<h3>Klik link untuk aktivasi:</h3><a href="${link}">Aktivasi Sekarang</a>`
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) return res.status(500).send('Gagal mengirim email');
    res.send('Email aktivasi terkirim ✅');
  });
});

// Endpoint verifikasi
app.get('/verify', (req, res) => {
  const { email, token } = req.query;
  if (!email || !token) return res.send('Invalid link');

  if (db[email] && db[email].token === token) {
    db[email].verified = true;
    res.send('Email berhasil diverifikasi ✅, sekarang bisa pakai bot titip paket');
  } else {
    res.send('Token salah atau email tidak terdaftar');
  }
});

app.listen(process.env.PORT, () => console.log(`Server berjalan di port ${process.env.PORT}`));
