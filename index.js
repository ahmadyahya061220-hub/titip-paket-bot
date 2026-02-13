require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const puppeteer = require("puppeteer");

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const INDOPAKET_EMAIL = process.env.INDOPAKET_EMAIL;
const INDOPAKET_PASSWORD = process.env.INDOPAKET_PASSWORD;

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// ---- Function ambil resi dari website ----
async function ambilResi(namaPengirim, namaPenerima, berat) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto("https://indopaket.com/login", { waitUntil: "networkidle2" });

    // Login
    await page.type("input[name=email]", INDOPAKET_EMAIL);
    await page.type("input[name=password]", INDOPAKET_PASSWORD);
    await page.click("button[type=submit]");
    await page.waitForNavigation({ waitUntil: "networkidle2" });

    // Masuk ke halaman titip paket
    await page.goto("https://indopaket.com/titip-paket", { waitUntil: "networkidle2" });

    // Isi form pengiriman
    await page.type("input[name=nama_pengirim]", namaPengirim);
    await page.type("input[name=nama_penerima]", namaPenerima);
    await page.type("input[name=berat]", berat.toString());

    // Submit form
    await page.click("button[type=submit]");
    await page.waitForSelector(".nomor-resi"); // Asumsi class nomor resi

    // Ambil nomor resi
    const resi = await page.$eval(".nomor-resi", el => el.innerText);

    await browser.close();
    return resi;

  } catch (err) {
    await browser.close();
    console.error(err);
    return null;
  }
}

// ----- Bot Telegram -----
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id,
`🤖 Bot Titip Paket Realtime
Ketik: /titip [NamaPengirim] [NamaPenerima] [BeratKg]

Contoh:
/titip Andy Budi 1`);
});

// Command titip paket
bot.onText(/\/titip (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const input = match[1].split(" ");

  if (input.length < 3) {
    return bot.sendMessage(chatId, "Format salah. Contoh: /titip Andy Budi 1");
  }

  const namaPengirim = input[0];
  const namaPenerima = input[1];
  const berat = parseInt(input[2]);

  bot.sendMessage(chatId, "⏳ Sedang memproses titip paket dan mengambil nomor resi...");

  const resi = await ambilResi(namaPengirim, namaPenerima, berat);

  if (resi) {
    bot.sendMessage(chatId, `✅ Paket berhasil dibuat!\nNomor Resi: ${resi}`);
    bot.sendMessage(ADMIN_ID,
      `🔔 TRANSAKSI BARU\nPengirim: ${namaPengirim}\nPenerima: ${namaPenerima}\nBerat: ${berat} kg\nResi: ${resi}`
    );
  } else {
    bot.sendMessage(chatId, "❌ Gagal membuat paket / ambil resi. Cek akun Indopaket.");
  }
});
