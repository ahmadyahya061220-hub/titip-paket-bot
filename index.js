require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const ADMIN_ID = process.env.ADMIN_ID;

let sessions = {};
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
            resize_keyboard: true
        }
    });
}

// ================= START =================
bot.onText(/\/start/, (msg) => {
    sendMenu(msg.chat.id);
});

bot.onText(/\/menu/, (msg) => {
    sendMenu(msg.chat.id);
});

// ================= MESSAGE =================
bot.on("message", (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text) return;
    if (text === "/start" || text === "/menu") return;

    // ===== MENU =====
    if (text === "📦 Titip Paket") {
        sessions[chatId] = { step: 1 };
        bot.sendMessage(chatId, "📤 Masukkan Nama Pengirim:");
        return;
    }

    if (text === "💰 Tarif") {
        bot.sendMessage(chatId,
            "💰 Tarif:\nBiaya Garap Rp1.000/paket\nAdmin mengikuti AndiiLouw Ya Gess."
        );
        return;
    }

    if (text === "📞 Bantuan") {
        bot.sendMessage(chatId, "Hubungi admin jika ada kendala.");
        return;
    }

    if (text === "📋 Cek Status") {
        bot.sendMessage(chatId, "Masukkan ID Order:");
        sessions[chatId] = { cek: true };
        return;
    }

    // ===== INPUT DATA =====
    if (sessions[chatId]?.step === 1) {
        sessions[chatId].nama_pengirim = text;
        sessions[chatId].step = 2;
        bot.sendMessage(chatId, "📤 No HP Pengirim:");
        return;
    }

    if (sessions[chatId]?.step === 2) {
        sessions[chatId].hp_pengirim = text;
        sessions[chatId].step = 3;
        bot.sendMessage(chatId, "📦 Nama Penerima:");
        return;
    }

    if (sessions[chatId]?.step === 3) {
        sessions[chatId].nama_penerima = text;
        sessions[chatId].step = 4;
        bot.sendMessage(chatId, "📦 No HP Penerima:");
        return;
    }

    if (sessions[chatId]?.step === 4) {
        sessions[chatId].hp_penerima = text;
        sessions[chatId].step = 5;
        bot.sendMessage(chatId, "📍 Alamat Lengkap Penerima:");
        return;
    }

    if (sessions[chatId]?.step === 5) {
        sessions[chatId].alamat = text;
        sessions[chatId].step = 6;
        bot.sendMessage(chatId, "⚖️ Berat (kg):");
        return;
    }

    if (sessions[chatId]?.step === 6) {
        sessions[chatId].berat = text;

        const orderId = orderCounter++;

        orders[orderId] = {
            chatId: chatId,
            ...sessions[chatId],
            status: "MENUNGGU PROSES"
        };

        bot.sendMessage(chatId,
            `✅ Order berhasil dibuat!\n\n` +
            `ID Order: ${orderId}\n` +
            `Status: MENUNGGU PROSES`
        );

        bot.sendMessage(ADMIN_ID,
            `📦 ORDER BARU #${orderId}\n\n` +
            `👤 Pengirim: ${sessions[chatId].nama_pengirim}\n` +
            `📞 HP Pengirim: ${sessions[chatId].hp_pengirim}\n\n` +
            `👤 Penerima: ${sessions[chatId].nama_penerima}\n` +
            `📞 HP Penerima: ${sessions[chatId].hp_penerima}\n` +
            `📍 Alamat: ${sessions[chatId].alamat}\n` +
            `⚖️ Berat: ${sessions[chatId].berat} kg\n\n` +
            `Balas:\n/resi ${orderId} NOMOR_RESI`
        );

        delete sessions[chatId];
        return;
    }

    // ===== CEK STATUS =====
    if (sessions[chatId]?.cek) {
        const order = orders[text];
        if (order) {
            bot.sendMessage(chatId,
                `Status Order #${text}:\n${order.status}`
            );
        } else {
            bot.sendMessage(chatId, "ID tidak ditemukan.");
        }
        delete sessions[chatId];
        return;
    }
});

// ===== ADMIN INPUT RESI =====
bot.onText(/\/resi (.+)/, (msg, match) => {
    if (msg.chat.id.toString() !== ADMIN_ID) {
        bot.sendMessage(msg.chat.id, "Anda bukan admin.");
        return;
    }

    const data = match[1].split(" ");
    const orderId = data[0];
    const resi = data[1];

    if (orders[orderId]) {
        orders[orderId].status = "SELESAI";

        bot.sendMessage(orders[orderId].chatId,
            `📦 Resi Anda:\n${resi}\n\n` +
            `Silakan proses di Indomaret terdekat.`
        );

        bot.sendMessage(msg.chat.id,
            `✅ Resi ${resi} berhasil dikirim.`
        );
    } else {
        bot.sendMessage(msg.chat.id, "Order tidak ditemukan.");
    }
});

console.log("Bot Titip Paket Aktif ✅");
