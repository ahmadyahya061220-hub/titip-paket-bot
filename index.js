require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const ADMIN_ID = process.env.ADMIN_ID;

let orders = {};
let orderCounter = 1;

// ================= MENU =================
function sendMenu(chatId) {
    bot.sendMessage(chatId, "Silakan pilih layanan:", {
        reply_markup: {
            keyboard: [
                ["📦 Titip Paket"],
                ["📋 Cek Status", "💰 Tarif"],
                ["📞 Bantuan"]
            ],
            resize_keyboard: true,
            one_time_keyboard: false
        }
    });
}

// ================= START & MENU =================
bot.onText(/\/start/, (msg) => {
    sendMenu(msg.chat.id);
});

bot.onText(/\/menu/, (msg) => {
    sendMenu(msg.chat.id);
});

// ================= MESSAGE HANDLER =================
bot.on("message", (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text) return;

    // Hindari bentrok command
    if (text === "/start" || text === "/menu") return;

    // ================= MENU BUTTON =================
    if (text === "📦 Titip Paket") {
        orders[chatId] = { step: 1 };
        bot.sendMessage(chatId, "Masukkan Nama Penerima:");
        return;
    }

    if (text === "💰 Tarif") {
        bot.sendMessage(chatId,
            "💰 Tarif Titip Paket:\n\n" +
            "Biaya Admin: Rp1.000 per paket\n" +
            "Biaya Admin Apa Jare AndiiLouw Ya Gess."
        );
        return;
    }

    if (text === "📞 Bantuan") {
        bot.sendMessage(chatId,
            "📞 Bantuan:\nHubungi Admin jika ada kendala."
        );
        return;
    }

    if (text === "📋 Cek Status") {
        bot.sendMessage(chatId,
            "Silakan kirim ID Order Anda.\nContoh: 1"
        );
        orders[chatId] = { cekStatus: true };
        return;
    }

    // ================= PROSES ORDER =================
    if (orders[chatId]?.step === 1) {
        orders[chatId].nama = text;
        orders[chatId].step = 2;
        bot.sendMessage(chatId, "Masukkan No HP Penerima:");
        return;
    }

    if (orders[chatId]?.step === 2) {
        orders[chatId].hp = text;
        orders[chatId].step = 3;
        bot.sendMessage(chatId, "Masukkan Alamat Lengkap:");
        return;
    }

    if (orders[chatId]?.step === 3) {
        orders[chatId].alamat = text;
        orders[chatId].step = 4;
        bot.sendMessage(chatId, "Masukkan Berat (kg):");
        return;
    }

    if (orders[chatId]?.step === 4) {
        orders[chatId].berat = text;

        const orderId = orderCounter++;
        orders[chatId].id = orderId;
        orders[chatId].status = "MENUNGGU PROSES";

        const detail =
            `📦 ORDER BARU #${orderId}\n\n` +
            `Nama: ${orders[chatId].nama}\n` +
            `HP: ${orders[chatId].hp}\n` +
            `Alamat: ${orders[chatId].alamat}\n` +
            `Berat: ${orders[chatId].berat} kg\n\n` +
            `Balas dengan:\n/resi ${orderId} NOMOR_RESI`;

        bot.sendMessage(ADMIN_ID, detail);

        bot.sendMessage(chatId,
            `✅ Order berhasil dibuat!\n\n` +
            `ID Order: ${orderId}\n` +
            `Status: MENUNGGU PROSES\n\n` +
            `Resi akan dikirim setelah diproses.`
        );

        return;
    }

    // ================= CEK STATUS =================
    if (orders[chatId]?.cekStatus) {
        let found = false;

        for (let id in orders) {
            if (orders[id].id == text) {
                bot.sendMessage(chatId,
                    `Status Order #${text}:\n${orders[id].status}`
                );
                found = true;
                break;
            }
        }

        if (!found) {
            bot.sendMessage(chatId, "ID Order tidak ditemukan.");
        }

        orders[chatId] = null;
        return;
    }
});

// ================= ADMIN INPUT RESI =================
bot.onText(/\/resi (.+)/, (msg, match) => {
    if (msg.chat.id.toString() !== ADMIN_ID) {
        bot.sendMessage(msg.chat.id, "Anda bukan admin.");
        return;
    }

    const data = match[1].split(" ");
    const orderId = data[0];
    const resi = data[1];

    for (let chatId in orders) {
        if (orders[chatId]?.id == orderId) {
            orders[chatId].status = "SELESAI";

            bot.sendMessage(chatId,
                `📦 Resi Anda:\n${resi}\n\n` +
                `Silakan proses di Indomaret terdekat.`
            );

            bot.sendMessage(msg.chat.id,
                `✅ Resi ${resi} berhasil dikirim ke user.`
            );
            return;
        }
    }

    bot.sendMessage(msg.chat.id, "Order tidak ditemukan.");
});

console.log("Bot Titip Paket Aktif ✅");
