require("dotenv").config();
const puppeteer = require("puppeteer");
const TelegramBot = require("node-telegram-bot-api");

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

async function buatResi() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();

  await page.goto("https://WEBSITEANDA.com/login", { waitUntil: "networkidle2" });

  await page.type("#email", process.env.WEBSITE_EMAIL);
  await page.type("#password", process.env.WEBSITE_PASSWORD);
  await page.click("#loginButton");

  await page.waitForNavigation();

  await page.goto("https://WEBSITEANDA.com/titip-paket");

  await page.type("#berat", "1");
  await page.type("#panjang", "10");
  await page.type("#lebar", "10");
  await page.type("#tinggi", "10");

  await page.click("#submitButton");

  await page.waitForSelector("#nomorResi");

  const resi = await page.$eval("#nomorResi", el => el.textContent);

  await browser.close();

  return resi;
}

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "Klik 📦 Titip Paket");
});

bot.on("message", async (msg) => {
  if (msg.text === "📦 Titip Paket") {

    bot.sendMessage(msg.chat.id, "⏳ Memproses...");

    try {
      const resi = await buatResi();

      bot.sendMessage(msg.chat.id,
`✅ BERHASIL
Nomor Resi:
${resi}`);

    } catch (err) {
      bot.sendMessage(msg.chat.id, "❌ Gagal.");
    }
  }
});
