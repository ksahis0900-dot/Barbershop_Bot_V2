require('dotenv').config();
const SafeBot = require('./lib/bot-helper');
const db = require('./lib/db');
const moment = require('moment');

// Configuration
const TOKEN = process.env.BOT_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const PORT = process.env.PORT || 3000;

// Initialize bot
let bot;

if (!TOKEN) {
    console.error('❌ CRITICAL ERROR: BOT_TOKEN is missing!');
}

if (process.env.VERCEL) {
    bot = new SafeBot(TOKEN || 'dummy');
} else {
    bot = new SafeBot(TOKEN, { polling: true });
    console.log('🤖 Bot started in POLLING mode (Version 1.5.0)');
}

// ====== HANDLERS ======

bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const settings = db.data.settings || {};
    const username = msg.from.username || msg.from.first_name;

    const welcomeText = `
💈 *${settings.name || 'Retro Barbershop'}*
---
Привет, *${username}*! Мы рады видеть тебя. 

Запишись к нам через Мини-приложение — это быстро и удобно. Выбирай мастера, услуги и удобное время прямо сейчас!

📍 *Адрес:* ${settings.address || 'ул. Центральная, 123'}
📞 *Тел:* ${settings.phone || '+7 (999) 123-45-67'}
⏰ *Работаем:* ${settings.working_hours?.start || '10:00'} - ${settings.working_hours?.end || '21:00'}
  `;

    const options = {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{
                    text: '📅 ЗАПИСАТЬСЯ ОНЛАЙН',
                    web_app: { url: process.env.MINI_APP_URL || 'https://barbershop-bot-v2.vercel.app' }
                }],
                [{ text: '⭐ Мои записи', callback_data: 'my_bookings' }]
            ]
        }
    };

    await bot.safeSendMessage(chatId, welcomeText, options);
});

bot.on('web_app_data', async (msg) => {
    const chatId = msg.chat.id;
    const data = JSON.parse(msg.web_app_data.data);

    // Format date for display
    const formattedDate = moment(data.date).format('D MMMM (dd)');

    const bookingText = `
✅ *ОТЛИЧНЫЙ ВЫБОР!*

Вы почти записались:
📅 *Когда:* ${formattedDate} в *${data.time}*
👤 *Мастер:* ${data.master.name}
⏳ *Длительность:* ~${data.duration} мин

💇 *Услуги:*
${data.services.map(s => `• ${s.name}`).join('\n')}

💰 *Итого к оплате:* ${data.total}₽

👇 *Для завершения, пожалуйста, подтвердите ваш номер телефона:*
  `;

    const options = {
        parse_mode: 'Markdown',
        reply_markup: {
            keyboard: [[{ text: '📱 ПОДТВЕРДИТЬ НОМЕР', request_contact: true }]],
            resize_keyboard: true,
            one_time_keyboard: true
        }
    };

    db.setUserState(chatId, { step: 'awaiting_contact', booking: data });
    await bot.safeSendMessage(chatId, bookingText, options);
});

bot.on('contact', async (msg) => {
    const chatId = msg.chat.id;
    const state = db.getUserState(chatId);

    if (state && state.step === 'awaiting_contact') {
        const booking = state.booking;
        const contact = msg.contact;

        const finalBooking = {
            id: Date.now(),
            telegramUserId: chatId,
            ...booking,
            clientName: contact.first_name + (contact.last_name ? ` ${contact.last_name}` : ''),
            clientPhone: contact.phone_number,
            createdAt: new Date().toISOString()
        };

        db.data.bookings.push(finalBooking);
        db.save();
        db.clearUserState(chatId);

        const successText = `
🎉 *ВЫ ЗАПИСАНЫ!*

Ждем вас *${moment(booking.date).format('D MMMM')}* к *${booking.time}*.
Мастер *${booking.master.name}* уже готовит инструменты! ✂️

Если ваши планы изменятся, пожалуйста, предупредите нас заранее.
  `;

        await bot.safeSendMessage(chatId, successText, {
            parse_mode: 'Markdown',
            reply_markup: { remove_keyboard: true }
        });

        // Notify master if they have a chatId registered
        if (booking.master.chatId) {
            const masterMsg = `
🔔 *НОВАЯ ЗАПИСЬ!*
---
📅 ${moment(booking.date).format('D MMMM')} в ${booking.time}
👤 Клиент: ${finalBooking.clientName}
📞 Тел: ${finalBooking.clientPhone}
💇 Услуги: ${booking.services.map(s => s.name).join(', ')}
💰 Сумма: ${booking.total}₽
            `;
            await bot.safeSendMessage(booking.master.chatId, masterMsg, { parse_mode: 'Markdown' });
        }
    }
});

bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;

    if (query.data === 'my_bookings') {
        const userBookings = db.data.bookings.filter(b => b.telegramUserId === chatId);

        if (userBookings.length === 0) {
            await bot.safeSendMessage(chatId, "🤷‍♂️ У вас пока нет активных записей.");
        } else {
            const text = `
📜 *ВАШИ ЗАПИСИ:*
${userBookings.map(b => `\n📅 *${moment(b.date).format('DD.MM')}* в *${b.time}*\n💈 Мастер: ${b.master.name}\n💰 ${b.total}₽`).join('\n---\n')}
            `;
            await bot.safeSendMessage(chatId, text, { parse_mode: 'Markdown' });
        }
    }
    bot.safeAnswerCallbackQuery(query.id);
});

module.exports = bot;
