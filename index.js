require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

const ADMIN_ID = process.env.ADMIN_ID;

let orders = {};
let orderCounter = 1;

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id,
        "Selamat datang di Bot Titip Paket\n\n" +
        "Klik menu:\n" +
        "📦 Titip Paket"
    );
});

bot.on("message", async (msg) => {
    const chatId = msg.chat.id;

    if (msg.text === "📦 Titip Paket") {
        orders[chatId] = { step: 1 };
        bot.sendMessage(chatId, "Masukkan Nama Penerima:");
    }

    else if (orders[chatId]?.step === 1) {
        orders[chatId].nama = msg.text;
        orders[chatId].step = 2;
        bot.sendMessage(chatId, "Masukkan No HP Penerima:");
    }

    else if (orders[chatId]?.step === 2) {
        orders[chatId].hp = msg.text;
        orders[chatId].step = 3;
        bot.sendMessage(chatId, "Masukkan Alamat Lengkap:");
    }

    else if (orders[chatId]?.step === 3) {
        orders[chatId].alamat = msg.text;
        orders[chatId].step = 4;
        bot.sendMessage(chatId, "Masukkan Berat (kg):");
    }

    else if (orders[chatId]?.step === 4) {
        orders[chatId].berat = msg.text;

        const orderId = orderCounter++;
        orders[chatId].id = orderId;
        orders[chatId].status = "MENUNGGU PROSES";

        const detail =
            `ORDER BARU #${orderId}\n\n` +
            `Nama: ${orders[chatId].nama}\n` +
            `HP: ${orders[chatId].hp}\n` +
            `Alamat: ${orders[chatId].alamat}\n` +
            `Berat: ${orders[chatId].berat} kg\n\n` +
            `Balas dengan:\n/resi ${orderId} NOMOR_RESI`;

        bot.sendMessage(ADMIN_ID, detail);

        bot.sendMessage(chatId,
            `Order berhasil dikirim!\n\n` +
            `ID Order: ${orderId}\n` +
            `Status: MENUNGGU PROSES\n\n` +
            `Resi akan dikirim setelah diproses.`
        );

        delete orders[chatId];
    }
});

bot.onText(/\/resi (.+)/, (msg, match) => {
    if (msg.chat.id.toString() !== ADMIN_ID) return;

    const data = match[1].split(" ");
    const orderId = data[0];
    const resi = data[1];

    for (let chatId in orders) {
        if (orders[chatId].id == orderId) {
            bot.sendMessage(chatId,
                `📦 Resi Anda:\n${resi}\n\n` +
                `Silakan proses di Indomaret terdekat.`
            );
            delete orders[chatId];
            break;
        }
    }

    bot.sendMessage(msg.chat.id, `Resi ${resi} berhasil dikirim.`);
});

console.log("Bot Titip Paket Aktif ✅");
function sendMenu(chatId) {
    bot.sendMessage(chatId, "Silakan pilih layanan:", {
        reply_markup: {
            keyboard: [
                ["📦 Titip Paket"],
                ["📋 Cek Status", "💰 Tarif"],
                ["📞 Bantuan"]
            ],
            resize_keyboard: true
        }
    });
}
bot.onText(/\/start/, (msg) => {
    sendMenu(msg.chat.id);
});

bot.onText(/\/menu/, (msg) => {
    sendMenu(msg.chat.id);
});
if (msg.text === "💰 Tarif") {
    bot.sendMessage(chatId,
        "💰 Tarif Titip Paket:\n\n" +
        "Biaya Admin: Rp1.000 per paket\n" +
        "Harga ongkir mengikuti sistem Indopaket."
    );
}

if (msg.text === "📞 Bantuan") {
    bot.sendMessage(chatId,
        "📞 Bantuan:\n\n" +
        "Hubungi Admin:\n" +
        "@AndiiLouw"
    );
}

if (msg.text === "📋 Cek Status") {
    bot.sendMessage(chatId,
        "Silakan kirim ID Order untuk cek status."
    );
}

