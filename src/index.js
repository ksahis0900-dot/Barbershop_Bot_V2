require('dotenv').config();
const SafeBot = require('./lib/bot-helper');
const db = require('./lib/db');
const moment = require('moment');

// Configuration
const TOKEN = process.env.BOT_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL; // Required for Vercel
const PORT = process.env.PORT || 3000;

// Initialize bot
let bot;

if (!TOKEN) {
    console.error('❌ CRITICAL ERROR: BOT_TOKEN is missing from environment variables!');
}

if (process.env.VERCEL) {
    // Serverless mode (Webhook)
    bot = new SafeBot(TOKEN || 'dummy');
    // Webhook will be handled by the API route
} else {
    // Local mode (Polling)
    bot = new SafeBot(TOKEN, { polling: true });
    console.log('🤖 Bot started in POLLING mode');
}

// ====== HANDLERS ======

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username || msg.from.first_name;

    const welcomeText = `
👋 Привет, ${username}!

Добро пожаловать в *Retro Barbershop* 💈

Теперь записаться стало еще проще! Нажмите кнопку ниже, чтобы открыть наше современное Мини-приложение и выбрать лучшие услуги в пару кликов.

📍 Адрес: ул. Центральная, 123
📞 Телефон: +7 (999) 123-45-67
  `;

    const options = {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{
                    text: '🚀 ОТКРЫТЬ ЗАПИСЬ',
                    web_app: { url: process.env.MINI_APP_URL || 'https://retro-barber-app.vercel.app' }
                }],
                [{ text: '📍 Контакты', callback_data: 'contacts' }]
            ]
        }
    };

    bot.safeSendMessage(chatId, welcomeText, options);
});

// Handle data from Web App
bot.on('web_app_data', async (msg) => {
    const chatId = msg.chat.id;
    const data = JSON.parse(msg.web_app_data.data);

    const bookingText = `
✨ *ЗАПЯВКА ИЗ ПРИЛОЖЕНИЯ* ✨

💇 *Услуги:*
${data.services.map(s => `• ${s.name} (${s.price}₽)`).join('\n')}

👨‍💼 *Мастер:* ${data.master.name}
💰 *Итого:* ${data.total}₽

Для завершения записи, пожалуйста, отправьте свой контакт:
  `;

    const options = {
        parse_mode: 'Markdown',
        reply_markup: {
            keyboard: [[{ text: '📱 Поделиться контактом', request_contact: true }]],
            resize_keyboard: true,
            one_time_keyboard: true
        }
    };

    // Save partial booking to state
    db.setUserState(chatId, { step: 'awaiting_contact', booking: data });

    bot.safeSendMessage(chatId, bookingText, options);
});

bot.on('contact', async (msg) => {
    const chatId = msg.chat.id;
    const state = db.getUserState(chatId);

    if (state && state.step === 'awaiting_contact') {
        const booking = state.booking;
        const contact = msg.contact;

        const finalBooking = {
            ...booking,
            clientName: contact.first_name + (contact.last_name ? ` ${contact.last_name}` : ''),
            clientPhone: contact.phone_number,
            date: moment().format('YYYY-MM-DD'), // Default for now, can be picked in app
            time: 'По согласованию',
            createdAt: new Date().toISOString()
        };

        db.addBooking(finalBooking);
        db.clearUserState(chatId);

        const successText = `
🎉 *СПАСИБО ЗА ЗАПИСЬ!* 🎉

Ваши данные переданы мастеру *${booking.master.name}*.
Он свяжется с вами в течение 15 минут для подтверждения времени.

💈 До встречи в Retro!
    `;

        bot.safeSendMessage(chatId, successText, {
            parse_mode: 'Markdown',
            reply_markup: { remove_keyboard: true }
        });

        // Notify master if registered (similar to original logic)
        // ... notifyMaster(booking.master, finalBooking);
    }
});

// Callback handlers
bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    if (query.data === 'contacts') {
        const text = `
📍 *Retro Barbershop*
🏠 Адрес: ул. Центральная, 123
📞 +7 (999) 123-45-67
🕐 10:00 - 20:00
    `;
        bot.safeSendMessage(chatId, text, { parse_mode: 'Markdown' });
    }
    bot.safeAnswerCallbackQuery(query.id);
});

// Error logging
bot.on('polling_error', (error) => console.error('Polling error:', error.message));
bot.on('error', (error) => console.error('General error:', error.message));

module.exports = bot; // Export for Vercel
