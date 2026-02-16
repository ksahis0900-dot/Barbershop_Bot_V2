require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const moment = require('moment');

// Конфигурация
const TOKEN = process.env.BOT_TOKEN;
const ADMIN_PIN = process.env.ADMIN_PIN || '1234';
const DATA_FILE = path.join(__dirname, '../data/database.json');

// Инициализация бота
const bot = new TelegramBot(TOKEN, { polling: true });

// Хранилище состояний пользователей
const userStates = new Map();

// Загрузка данных
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (error) {
    console.error('Ошибка загрузки данных:', error);
  }
  return {
    services: [],
    masters: [],
    bookings: [],
    adminPin: ADMIN_PIN,
    adminSessions: {}
  };
}

// Сохранение данных
function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Ошибка сохранения данных:', error);
  }
}

// Получение данных
let db = loadData();

// Время работы
const WORKING_HOURS = {
  start: 10,
  end: 20
};

// ====== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ======

// Проверка занятости слота
function isTimeSlotAvailable(masterId, date, time) {
  return !db.bookings.some(booking => 
    booking.masterId === masterId &&
    booking.date === date &&
    booking.time === time
  );
}

// Получение доступных слотов
function getAvailableSlots(masterId, date) {
  const slots = [];
  for (let hour = WORKING_HOURS.start; hour <= WORKING_HOURS.end; hour++) {
    const time = `${hour.toString().padStart(2, '0')}:00`;
    if (isTimeSlotAvailable(masterId, date, time)) {
      slots.push(time);
    }
  }
  return slots;
}

// Форматирование даты
function formatDate(date) {
  return moment(date).format('DD.MM.YYYY');
}

// Русские названия дней недели
const weekDays = {
  'Monday': 'Понедельник',
  'Tuesday': 'Вторник',
  'Wednesday': 'Среда',
  'Thursday': 'Четверг',
  'Friday': 'Пятница',
  'Saturday': 'Суббота',
  'Sunday': 'Воскресенье'
};

// Форматирование даты с русским днем недели
function formatDateRussian(date) {
  const m = moment(date);
  const dayOfWeek = weekDays[m.format('dddd')] || m.format('dddd');
  return `${m.format('DD.MM.YYYY')} (${dayOfWeek})`;
}

// Форматирование списка услуг
function formatServices(services) {
  return services.map(s => `${s.name} - ${s.price}₽`).join('\n');
}

// Подсчет итоговой суммы
function calculateTotal(services) {
  return services.reduce((sum, s) => sum + s.price, 0);
}

// Подсчет длительности
function calculateDuration(services) {
  return services.reduce((sum, s) => sum + s.duration, 0);
}

// ====== КЛАВИАТУРЫ ======

// Главное меню
function getMainMenu() {
  return {
    reply_markup: {
      keyboard: [
        ['📅 Записаться', '👨‍💼 Наши мастера'],
        ['💇 Услуги и цены', '📍 Контакты'],
        ['⚙️ Админ панель']
      ],
      resize_keyboard: true
    }
  };
}

// Меню выбора услуг с визуальным feedback
function getServicesKeyboard(selectedServices = []) {
  const services = db.services.map(service => {
    const isSelected = selectedServices.find(s => s.id === service.id);
    const checkmark = isSelected ? '✅ ' : '⭕️ ';
    const price = isSelected ? `💰${service.price}₽` : `${service.price}₽`;
    
    return [{
      text: `${checkmark}${service.name} - ${price}`,
      callback_data: `service_${service.id}`
    }];
  });
  
  // Добавляем кнопку подтверждения с анимацией (если что-то выбрано)
  const totalPrice = calculateTotal(selectedServices);
  const confirmButton = selectedServices.length > 0 
    ? [{ 
        text: `✨ ПОДТВЕРДИТЬ ВЫБОР ✨ (${selectedServices.length} шт. = ${totalPrice}₽)`, 
        callback_data: 'confirm_services' 
      }]
    : [{ 
        text: '⬆️ Выберите услуги выше ⬆️', 
        callback_data: 'no_services_selected' 
      }];
  
  services.push(confirmButton);
  services.push([{ text: '❌ Отменить запись', callback_data: 'cancel_booking' }]);
  
  return {
    reply_markup: {
      inline_keyboard: services
    }
  };
}

// Меню выбора мастера
function getMastersKeyboard() {
  const masters = db.masters.map(master => {
    const stars = '⭐'.repeat(Math.floor(master.rating));
    return [{
      text: `👨‍💼 ${master.name} \n💼 ${master.title} ${stars}`,
      callback_data: `master_${master.id}`
    }];
  });
  
  masters.push([{ text: '❌ Отменить запись', callback_data: 'cancel_booking' }]);
  
  return {
    reply_markup: {
      inline_keyboard: masters
    }
  };
}

// Меню выбора даты (красивый календарь)
// Меню выбора даты (календарь по месяцам с навигацией)
function getDateKeyboard(year = null, month = null) {
  const keyboard = [];
  const today = moment();
  const currentYear = year || today.year();
  const currentMonth = month !== null ? month : today.month();
  
  const displayDate = moment([currentYear, currentMonth]);
  
  const monthNames = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];
  
  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
  const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
  const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
  
  keyboard.push([
    { text: '◀️', callback_data: `month_prev_${prevYear}_${prevMonth}` },
    { text: `📅 ${monthNames[currentMonth]} ${currentYear}`, callback_data: 'month_header' },
    { text: '▶️', callback_data: `month_next_${nextYear}_${nextMonth}` }
  ]);
  
  keyboard.push([
    { text: 'Пн', callback_data: 'header' },
    { text: 'Вт', callback_data: 'header' },
    { text: 'Ср', callback_data: 'header' },
    { text: 'Чт', callback_data: 'header' },
    { text: 'Пт', callback_data: 'header' },
    { text: 'Сб', callback_data: 'header' },
    { text: 'Вс', callback_data: 'header' }
  ]);
  
  const firstDay = displayDate.clone().startOf('month');
  const lastDay = displayDate.clone().endOf('month');
  
  let firstDayOfWeek = firstDay.day();
  firstDayOfWeek = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
  
  let week = [];
  
  for (let i = 0; i < firstDayOfWeek; i++) {
    week.push({ text: ' ', callback_data: 'empty' });
  }
  
  for (let day = 1; day <= lastDay.date(); day++) {
    const currentDate = displayDate.clone().date(day);
    const dateStr = currentDate.format('YYYY-MM-DD');
    const isToday = currentDate.isSame(today, 'day');
    const isPast = currentDate.isBefore(today, 'day');
    
    let displayText;
    if (isToday) {
      displayText = `🔴${day}`;
    } else if (isPast) {
      displayText = `⬛${day}`;
    } else {
      displayText = `${day}`;
    }
    
    week.push({
      text: displayText,
      callback_data: isPast ? 'past_date' : `date_${dateStr}`
    });
    
    if (week.length === 7 || day === lastDay.date()) {
      while (week.length < 7) {
        week.push({ text: ' ', callback_data: 'empty' });
      }
      keyboard.push(week);
      week = [];
    }
  }
  
  keyboard.push([{ text: '❌ Отменить запись', callback_data: 'cancel_booking' }]);
  
  return {
    reply_markup: {
      inline_keyboard: keyboard
    }
  };
}

// Меню выбора времени
function getTimeKeyboard(masterId, date) {
  const slots = getAvailableSlots(masterId, date);
  
  if (slots.length === 0) {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '⚠️ НЕТ СВОБОДНЫХ СЛОТОВ', callback_data: 'no_slots' }],
          [{ text: '🔙 Выбрать другую дату', callback_data: 'back_to_date' }],
          [{ text: '❌ Отменить запись', callback_data: 'cancel_booking' }]
        ]
      }
    };
  }
  
  // Разбиваем на группы по 3 кнопки в ряд для компактности
  const timeButtons = [];
  for (let i = 0; i < slots.length; i += 3) {
    const row = slots.slice(i, i + 3).map(time => ({
      text: `🕐 ${time}`,
      callback_data: `time_${time}`
    }));
    timeButtons.push(row);
  }
  
  timeButtons.push([{ text: '🔙 Выбрать другую дату', callback_data: 'back_to_date' }]);
  timeButtons.push([{ text: '❌ Отменить запись', callback_data: 'cancel_booking' }]);
  
  return {
    reply_markup: {
      inline_keyboard: timeButtons
    }
  };
}

// ====== ОБРАБОТЧИКИ КОМАНД ======

// /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username || msg.from.first_name;
  
  const welcomeText = `
👋 Привет, ${username}!

Добро пожаловать в *Retro Barbershop* 💈

Здесь ты можешь записаться к лучшим мастерам города. Выбирай удобное время и приходи за классной стрижкой!

📍 Адрес: ул. Центральная, 123
📞 Телефон: +7 (999) 123-45-67
🕐 Режим работы: 10:00 - 20:00
  `;
  
  bot.sendMessage(chatId, welcomeText, {
    parse_mode: 'Markdown',
    ...getMainMenu()
  });
});

// /help
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  
  const helpText = `
📋 *Справка по боту:*

📅 *Записаться* - начать процесс записи
👨‍💼 *Наши мастера* - список барберов
💇 *Услуги и цены* - прайс-лист
📍 *Контакты* - адрес и телефон
⚙️ *Админ панель* - управление (требуется PIN)

*Для мастеров:*
/iammaster - получать уведомления о записях

В процессе записи:
1️⃣ Выбери услуги (можно несколько)
2️⃣ Выбери мастера
3️⃣ Выбери дату
4️⃣ Выбери время
5️⃣ Подтверди запись

Для отмены записи в любой момент нажми "❌ Отменить"
  `;
  
  bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
});

// Команда для мастеров
bot.onText(/\/iammaster/, (msg) => {
  const chatId = msg.chat.id;
  const name = msg.from.first_name;
  
  // Проверяем, не зарегистрирован ли уже этот chatId
  const alreadyRegistered = db.masters.find(m => m.chatId === chatId);
  if (alreadyRegistered) {
    bot.sendMessage(
      chatId,
      `✅ Вы уже зарегистрированы как *${alreadyRegistered.name}*.\n\nУведомления о записях будут приходить автоматически.`,
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  // Ищем мастера по имени или показываем список
  const mastersList = db.masters.map((m, idx) => `${idx + 1}. ${m.name}`).join('\n');
  
  bot.sendMessage(
    chatId,
    `👨‍💼 *Регистрация мастера*\n\nКакой номер в списке соответствует вам?\n\n${mastersList}\n\nВведите номер:`,
    { parse_mode: 'Markdown' }
  );
  
  // Сохраняем текущее состояние (если админ)
  const currentState = userStates.get(chatId) || {};
  userStates.set(chatId, {
    ...currentState,  // Сохраняем существующее состояние (включая admin)
    step: 'master_registration',
    masterChatId: chatId
  });
});

// ====== ОБРАБОТЧИКИ ТЕКСТОВЫХ СООБЩЕНИЙ ======

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  
  // Обработка контакта (когда пользователь делится контактом)
  if (msg.contact && userStates.has(chatId)) {
    const state = userStates.get(chatId);
    if (state.step === 'awaiting_contact') {
      // Сохраняем данные пользователя
      state.userProfile = {
        firstName: msg.contact.first_name,
        lastName: msg.contact.last_name || '',
        phoneNumber: msg.contact.phone_number,
        userId: msg.contact.user_id
      };
      
      // Показываем подтверждение с данными
      confirmBookingWithContact(chatId);
      return;
    }
  }
  
  // Обработка ввода PIN
  if (userStates.has(chatId)) {
    const state = userStates.get(chatId);
    if (state.step === 'awaiting_pin') {
      handlePinInput(chatId, text);
      return;
    }
  }
  
  switch (text) {
    case '📅 Записаться':
      startBooking(chatId);
      break;
      
    case '👨‍💼 Наши мастера':
      showMasters(chatId);
      break;
      
    case '💇 Услуги и цены':
      showServices(chatId);
      break;
      
    case '📍 Контакты':
      showContacts(chatId);
      break;
      
    case '⚙️ Админ панель':
      requestAdminAccess(chatId);
      break;
      
    default:
      // Проверяем, находится ли пользователь в процессе бронирования
      if (userStates.has(chatId)) {
        handleBookingInput(chatId, text);
      }
      break;
  }
});

// ====== ЛОГИКА ЗАПИСИ ======

function startBooking(chatId) {
  userStates.set(chatId, {
    step: 'selecting_services',
    services: [],
    master: null,
    date: null,
    time: null,
    userProfile: null
  });
  
  const initialText = `💇 *ВЫБЕРИТЕ УСЛУГИ*\n\n` +
    `✅ - выбрано\n` +
    `⭕️ - не выбрано\n\n` +
    `Нажимайте на услуги, чтобы добавить/убрать их из заказа`;
  
  bot.sendMessage(
    chatId,
    initialText,
    { parse_mode: 'Markdown', ...getServicesKeyboard([]) }
  );
}

function handleBookingInput(chatId, text) {
  const state = userStates.get(chatId);
  
  if (state.step === 'master_registration') {
    const masterIndex = parseInt(text) - 1;
    if (masterIndex >= 0 && masterIndex < db.masters.length) {
      const master = db.masters[masterIndex];
      master.chatId = state.masterChatId;
      saveData(db);
      
      bot.sendMessage(
        chatId,
        `✅ Отлично! Вы зарегистрированы как *${master.name}*.\n\nТеперь вам будут приходить уведомления о новых записях.`,
        { parse_mode: 'Markdown' }
      );
    } else {
      bot.sendMessage(chatId, '❌ Неверный номер. Попробуйте снова с командой /iammaster');
    }
    
    // Проверяем, был ли пользователь админом
    const wasAdmin = state.authenticated;
    userStates.delete(chatId);
    
    // Если был админом, восстанавливаем админскую сессию
    if (wasAdmin) {
      userStates.set(chatId, {
        step: 'admin_menu',
        authenticated: true,
        expiresAt: Date.now() + 30 * 60 * 1000
      });
      showAdminMenu(chatId);
    }
  }
}

function confirmBookingWithContact(chatId) {
  const state = userStates.get(chatId);
  const user = state.userProfile;
  
  const totalPrice = calculateTotal(state.services);
  const totalDuration = calculateDuration(state.services);
  
  const fullName = user.lastName 
    ? `${user.firstName} ${user.lastName}` 
    : user.firstName;
  
  const confirmationText = `
✨ *ПОДТВЕРЖДЕНИЕ ЗАПИСИ* ✨

─────────────────
💇 *ВЫБРАННЫЕ УСЛУГИ:*
${formatServices(state.services)}

─────────────────
👨‍💼 *МАСТЕР:* ${state.master.name}
   ${state.master.title} ⭐${state.master.rating}

📅 *ДАТА:* ${formatDateRussian(state.date)}
🕐 *ВРЕМЯ:* ${state.time}
⏱ *ДЛИТЕЛЬНОСТЬ:* ${totalDuration} мин

─────────────────
👤 *КЛИЕНТ:* ${fullName}
📱 *ТЕЛЕФОН:* ${user.phoneNumber}

─────────────────
💰 *ИТОГО К ОПЛАТЕ:* ${totalPrice}₽

✅ Все верно?
  `;
  
  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ ДА, ПОДТВЕРЖДАЮ', callback_data: 'confirm_booking' }
        ],
        [
          { text: '❌ Отменить запись', callback_data: 'cancel_booking' }
        ]
      ]
    }
  };
  
  // Убираем клавиатуру с кнопкой "Поделиться контактом"
  bot.sendMessage(chatId, confirmationText, { 
    parse_mode: 'Markdown', 
    reply_markup: { remove_keyboard: true }
  }).then(() => {
    bot.sendMessage(chatId, '👇 Выберите действие:', keyboard);
  });
}

// Отправка уведомления мастеру
function notifyMaster(master, booking) {
  if (!master.chatId) {
    console.log(`⚠️ У мастера ${master.name} не указан chatId для уведомлений`);
    return;
  }
  
  const totalPrice = calculateTotal(booking.services);
  const totalDuration = calculateDuration(booking.services);
  
  const message = `
🔔 *НОВАЯ ЗАПИСЬ!* 🔔

─────────────────
👤 *КЛИЕНТ:* ${booking.clientName}
📱 *ТЕЛЕФОН:* ${booking.clientPhone}

💇 *УСЛУГИ:*
${formatServices(booking.services)}

─────────────────
📅 *ДАТА:* ${formatDateRussian(booking.date)}
🕐 *ВРЕМЯ:* ${booking.time}
⏱ *ДЛИТЕЛЬНОСТЬ:* ${totalDuration} мин
💰 *СУММА:* ${totalPrice}₽

✨ Удачной работы! ✨
  `;
  
  bot.sendMessage(master.chatId, message, { parse_mode: 'Markdown' })
    .then(() => console.log(`✅ Уведомление отправлено мастеру ${master.name}`))
    .catch(err => console.error(`❌ Ошибка отправки уведомления мастеру ${master.name}:`, err));
}

function completeBooking(chatId) {
  const state = userStates.get(chatId);
  const user = state.userProfile;
  
  const fullName = user.lastName 
    ? `${user.firstName} ${user.lastName}` 
    : user.firstName;
  
  const booking = {
    id: Date.now(),
    userId: chatId,
    telegramUserId: user.userId,
    services: state.services,
    masterId: state.master.id,
    master: state.master,
    date: state.date,
    time: state.time,
    clientName: fullName,
    clientPhone: user.phoneNumber,
    createdAt: new Date().toISOString()
  };
  
  db.bookings.push(booking);
  saveData(db);
  
  // Отправляем уведомление мастеру
  notifyMaster(state.master, booking);
  
  const totalPrice = calculateTotal(state.services);
  
  const successText = `
🎉 *ЗАПИСЬ УСПЕШНО СОЗДАНА!* 🎉

✨ Ваша запись подтверждена!

─────────────────
👨‍💼 *МАСТЕР:* ${state.master.name}
📅 *ДАТА:* ${formatDateRussian(state.date)}
🕐 *ВРЕМЯ:* ${state.time}
💰 *СУММА:* ${totalPrice}₽

─────────────────
📍 *Retro Barbershop*
🏠 ул. Центральная, 123
📞 +7 (999) 123-45-67

💈 Ждем вас! 💈

Если нужно перенести или отменить запись, позвоните нам.
  `;
  
  bot.sendMessage(chatId, successText, { parse_mode: 'Markdown', ...getMainMenu() });
  userStates.delete(chatId);
}

// ====== INLINE КНОПКИ ======

bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const data = query.data;
  
  bot.answerCallbackQuery(query.id);
  
  // Выбор услуги
  if (data.startsWith('service_')) {
    const serviceId = parseInt(data.split('_')[1]);
    const service = db.services.find(s => s.id === serviceId);
    
    if (userStates.has(chatId)) {
      const state = userStates.get(chatId);
      const existingIndex = state.services.findIndex(s => s.id === serviceId);
      
      if (existingIndex >= 0) {
        state.services.splice(existingIndex, 1);
      } else {
        state.services.push(service);
      }
      
      // Обновляем сообщение с визуальным feedback
      const totalPrice = calculateTotal(state.services);
      const totalDuration = calculateDuration(state.services);
      
      let headerText = '💇 *ВЫБЕРИТЕ УСЛУГИ*\n\n';
      headerText += '✅ - выбрано\n';
      headerText += '⭕️ - не выбрано\n\n';
      
      if (state.services.length > 0) {
        headerText += `✨ *Выбрано:* ${state.services.length} услуг\n`;
        headerText += `💰 *Сумма:* ${totalPrice}₽\n`;
        headerText += `⏱ *Длительность:* ${totalDuration} мин\n\n`;
        headerText += '─────────────────\n';
      }
      
      bot.editMessageText(
        headerText,
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          ...getServicesKeyboard(state.services)
        }
      );
    }
  }
  
  // Обработка нажатия когда ничего не выбрано
  else if (data === 'no_services_selected') {
    bot.answerCallbackQuery(query.id, { 
      text: '⚠️ Сначала выберите хотя бы одну услугу!',
      show_alert: true 
    });
  }
  
  // Подтверждение услуг
  else if (data === 'confirm_services') {
    if (userStates.has(chatId)) {
      const state = userStates.get(chatId);
      if (state.services.length === 0) {
        bot.sendMessage(chatId, '⚠️ Выберите хотя бы одну услугу!');
        return;
      }
      
      state.step = 'selecting_master';
      bot.editMessageText(
        '👨‍💼 Выберите мастера:',
        {
          chat_id: chatId,
          message_id: messageId,
          ...getMastersKeyboard()
        }
      );
    }
  }
  
  // Выбор мастера
  else if (data.startsWith('master_')) {
    const masterId = parseInt(data.split('_')[1]);
    const master = db.masters.find(m => m.id === masterId);
    
    if (userStates.has(chatId)) {
      const state = userStates.get(chatId);
      state.master = master;
      state.step = 'selecting_date';
      
      bot.editMessageText(
        '📅 Выберите дату:',
        {
          chat_id: chatId,
          message_id: messageId,
          ...getDateKeyboard()
        }
      );
    }
  }
  
  // Навигация по месяцам - предыдущий месяц
  else if (data.startsWith('month_prev_')) {
    const parts = data.split('_');
    const year = parseInt(parts[2]);
    const month = parseInt(parts[3]);
    
    bot.editMessageReplyMarkup(
      getDateKeyboard(year, month).reply_markup,
      {
        chat_id: chatId,
        message_id: messageId
      }
    );
  }
  
  // Навигация по месяцам - следующий месяц
  else if (data.startsWith('month_next_')) {
    const parts = data.split('_');
    const year = parseInt(parts[2]);
    const month = parseInt(parts[3]);
    
    bot.editMessageReplyMarkup(
      getDateKeyboard(year, month).reply_markup,
      {
        chat_id: chatId,
        message_id: messageId
      }
    );
  }
  
  // Заголовок месяца (ничего не делаем)
  else if (data === 'month_header' || data === 'header' || data === 'empty') {
    bot.answerCallbackQuery(query.id);
  }
  
  // Прошедшая дата (нельзя выбрать)
  else if (data === 'past_date') {
    bot.answerCallbackQuery(query.id, { 
      text: '❌ Этот день уже прошел. Выберите будущую дату.',
      show_alert: true 
    });
  }
  
  // Выбор даты
  else if (data.startsWith('date_')) {
    const date = data.split('_')[1];
    
    if (userStates.has(chatId)) {
      const state = userStates.get(chatId);
      state.date = date;
      state.step = 'selecting_time';
      
      bot.editMessageText(
        `🕐 Выберите время для ${formatDateRussian(date)}:\n\n(Занятые слоты не отображаются)`,
        {
          chat_id: chatId,
          message_id: messageId,
          ...getTimeKeyboard(state.master.id, date)
        }
      );
    }
  }
  
  // Выбор времени
  else if (data.startsWith('time_')) {
    const time = data.split('_')[1];
    
    if (userStates.has(chatId)) {
      const state = userStates.get(chatId);
      state.time = time;
      state.step = 'awaiting_contact';
      
      bot.deleteMessage(chatId, messageId);
      
      // Отправляем красивое сообщение с кнопкой поделиться контактом
      const contactKeyboard = {
        reply_markup: {
          keyboard: [[{
            text: '📱 ПОДЕЛИТЬСЯ КОНТАКТОМ',
            request_contact: true
          }]],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      };
      
      let shareText = '👤 *ПОСЛЕДНИЙ ШАГ*\n\n';
      shareText += 'Нажмите кнопку ниже, чтобы поделиться своим контактом:\n\n';
      shareText += '📱 Ваше имя и телефон будут автоматически заполнены\n';
      shareText += '🔒 Данные защищены и используются только для записи';
      
      bot.sendMessage(chatId, shareText, { 
        parse_mode: 'Markdown', 
        ...contactKeyboard 
      });
    }
  }
  
  // Нет слотов
  else if (data === 'no_slots') {
    bot.sendMessage(chatId, '⚠️ На эту дату все слоты заняты. Выберите другую дату.');
  }
  
  // Назад к выбору даты
  else if (data === 'back_to_date') {
    if (userStates.has(chatId)) {
      const state = userStates.get(chatId);
      state.step = 'selecting_date';
      
      bot.editMessageText(
        '📅 Выберите дату:',
        {
          chat_id: chatId,
          message_id: messageId,
          ...getDateKeyboard()
        }
      );
    }
  }
  
  // Подтверждение записи
  else if (data === 'confirm_booking') {
    completeBooking(chatId);
    bot.deleteMessage(chatId, messageId);
  }
  
  // Отмена записи
  else if (data === 'cancel_booking') {
    userStates.delete(chatId);
    bot.deleteMessage(chatId, messageId).catch(() => {});
    // Убираем клавиатуру контакта если есть
    bot.sendMessage(chatId, '❌ Запись отменена', {
      reply_markup: { remove_keyboard: true }
    }).then(() => {
      bot.sendMessage(chatId, '👋 Вы можете начать заново через меню', getMainMenu());
    });
  }
  
  // Админ панель
  else if (data.startsWith('admin_')) {
    handleAdminActions(chatId, messageId, data);
  }
});

// ====== ПОКАЗ ИНФОРМАЦИИ ======

function showMasters(chatId) {
  let text = '👨‍💼 *Наши мастера:*\n\n';
  
  db.masters.forEach(master => {
    text += `*${master.name}* - ${master.title}\n`;
    text += `⭐ Рейтинг: ${master.rating}/5\n\n`;
  });
  
  text += 'Выбирай лучшего и записывайся! 📅';
  
  bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
}

function showServices(chatId) {
  let text = '💇 *Наши услуги:*\n\n';
  
  db.services.forEach(service => {
    text += `*${service.name}*\n`;
    text += `💰 ${service.price}₽ | ⏱ ${service.duration} мин\n\n`;
  });
  
  text += 'Нажмите "📅 Записаться" чтобы забронировать!';
  
  bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
}

function showContacts(chatId) {
  const text = `
📍 *Retro Barbershop*

🏠 Адрес: ул. Центральная, 123
📞 Телефон: +7 (999) 123-45-67
🕐 Режим работы: 10:00 - 20:00
⭐ Рейтинг: 4.9/5

Приходи за классной стрижкой! 💈
  `;
  
  bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
}

// ====== АДМИН ПАНЕЛЬ ======

function requestAdminAccess(chatId) {
  const state = {
    step: 'awaiting_pin',
    attempts: 0
  };
  
  userStates.set(chatId, state);
  
  bot.sendMessage(
    chatId,
    '🔐 Введите PIN-код для доступа к админ панели:',
    {
      reply_markup: {
        remove_keyboard: true
      }
    }
  );
}

function handlePinInput(chatId, pin) {
  const state = userStates.get(chatId);
  
  if (pin === db.adminPin) {
    state.step = 'admin_menu';
    state.authenticated = true;
    state.expiresAt = Date.now() + 30 * 60 * 1000; // 30 минут
    
    db.adminSessions[chatId] = state.expiresAt;
    saveData(db);
    
    showAdminMenu(chatId);
  } else {
    state.attempts++;
    
    if (state.attempts >= 3) {
      userStates.delete(chatId);
      bot.sendMessage(chatId, '❌ Превышено количество попыток. Доступ заблокирован.', getMainMenu());
    } else {
      bot.sendMessage(chatId, `❌ Неверный PIN. Осталось попыток: ${3 - state.attempts}`);
    }
  }
}

function showAdminMenu(chatId) {
  const keyboard = {
    reply_markup: {
      keyboard: [
        ['📋 Все записи', '📊 Статистика'],
        ['➕ Добавить услугу', '🗑 Удалить услугу'],
        ['➕ Добавить мастера', '🗑 Удалить мастера'],
        ['👨‍💼 Привязать мастера к Telegram', '🚪 Выйти из админки']
      ],
      resize_keyboard: true
    }
  };
  
  const stats = {
    totalBookings: db.bookings.length,
    todayBookings: db.bookings.filter(b => b.date === moment().format('YYYY-MM-DD')).length
  };
  
  const text = `
⚙️ *АДМИН ПАНЕЛЬ*

📊 Статистика:
• Всего записей: ${stats.totalBookings}
• На сегодня: ${stats.todayBookings}

Выберите действие:
  `;
  
  bot.sendMessage(chatId, text, { parse_mode: 'Markdown', ...keyboard });
}

function handleAdminActions(chatId, messageId, data) {
  // Реализация админских действий
  if (data === 'admin_exit') {
    delete db.adminSessions[chatId];
    saveData(db);
    userStates.delete(chatId);
    bot.sendMessage(chatId, '👋 Вы вышли из админ панели', getMainMenu());
  }
}

// ====== АДМИН КОМАНДЫ ======

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  
  // Проверяем, авторизован ли пользователь
  if (!userStates.has(chatId) || !userStates.get(chatId).authenticated) {
    return;
  }
  
  const state = userStates.get(chatId);
  
  // Выход из админки
  if (text === '🚪 Выйти из админки') {
    delete db.adminSessions[chatId];
    saveData(db);
    userStates.delete(chatId);
    bot.sendMessage(chatId, '👋 Вы вышли из админ панели', getMainMenu());
    return;
  }
  
  // Показать все записи
  if (text === '📋 Все записи') {
    showAllBookings(chatId);
    return;
  }
  
  // Статистика
  if (text === '📊 Статистика') {
    showStats(chatId);
    return;
  }
  
  // Добавление услуги
  if (text === '➕ Добавить услугу') {
    state.step = 'admin_adding_service';
    state.adminData = {};
    bot.sendMessage(chatId, 'Введите название услуги:');
    return;
  }
  
  // Добавление мастера
  if (text === '➕ Добавить мастера') {
    state.step = 'admin_adding_master';
    state.adminData = {};
    bot.sendMessage(chatId, 'Введите имя мастера:');
    return;
  }
  
  // Удаление услуги
  if (text === '🗑 Удалить услугу') {
    showDeleteServicesMenu(chatId);
    return;
  }
  
  // Удаление мастера
  if (text === '🗑 Удалить мастера') {
    showDeleteMastersMenu(chatId);
    return;
  }
  
  // Привязка мастера к Telegram
  if (text === '👨‍💼 Привязать мастера к Telegram') {
    showLinkMasterMenu(chatId);
    return;
  }
  
  // Обработка ввода данных для добавления
  handleAdminInput(chatId, text);
});

function handleAdminInput(chatId, text) {
  if (!userStates.has(chatId)) return;
  
  const state = userStates.get(chatId);
  
  if (state.step === 'admin_adding_service') {
    if (!state.adminData.name) {
      state.adminData.name = text;
      bot.sendMessage(chatId, 'Введите цену (в рублях):');
    } else if (!state.adminData.price) {
      state.adminData.price = parseInt(text);
      bot.sendMessage(chatId, 'Введите длительность (в минутах):');
    } else if (!state.adminData.duration) {
      state.adminData.duration = parseInt(text);
      
      const newService = {
        id: Date.now(),
        name: state.adminData.name,
        price: state.adminData.price,
        duration: state.adminData.duration
      };
      
      db.services.push(newService);
      saveData(db);
      
      // Возвращаемся в админ-меню
      state.step = 'admin_menu';
      state.adminData = {};
      bot.sendMessage(chatId, `✅ Услуга "${newService.name}" добавлена!`);
      showAdminMenu(chatId);
    }
  }
  
  else if (state.step === 'admin_adding_master') {
    if (!state.adminData.name) {
      state.adminData.name = text;
      bot.sendMessage(chatId, 'Введите должность (например: Top Barber):');
    } else if (!state.adminData.title) {
      state.adminData.title = text;
      bot.sendMessage(chatId, 'Введите рейтинг (например: 4.8):');
    } else if (!state.adminData.rating) {
      state.adminData.rating = parseFloat(text);
      
      const newMaster = {
        id: Date.now(),
        name: state.adminData.name,
        title: state.adminData.title,
        rating: state.adminData.rating,
        chatId: null
      };
      
      db.masters.push(newMaster);
      saveData(db);
      
      // Возвращаемся в админ-меню
      state.step = 'admin_menu';
      state.adminData = {};
      bot.sendMessage(chatId, `✅ Мастер "${newMaster.name}" добавлен!\n\nМастер может получать уведомления. Для этого ему нужно написать боту команду /iammaster`);
      showAdminMenu(chatId);
    }
  }
}

function showAllBookings(chatId) {
  if (db.bookings.length === 0) {
    bot.sendMessage(chatId, '📭 Записей пока нет');
    return;
  }
  
  // Показываем последние 5 записей с кнопками удаления
  const sortedBookings = [...db.bookings].sort((a, b) => 
    new Date(b.createdAt) - new Date(a.createdAt)
  );
  
  bot.sendMessage(chatId, '📋 *Последние записи:*\n\n_Нажмите 🗑 чтобы удалить запись_', { parse_mode: 'Markdown' });
  
  sortedBookings.slice(0, 5).forEach((booking) => {
    const totalPrice = calculateTotal(booking.services);
    const bookingText = `
👤 *${booking.clientName}*
📱 ${booking.clientPhone}
👨‍💼 ${booking.master.name}
📅 ${formatDateRussian(booking.date)} в ${booking.time}
💰 ${totalPrice}₽
    `;
    
    const keyboard = {
      reply_markup: {
        inline_keyboard: [[
          { text: '🗑 Удалить запись', callback_data: `delete_booking_${booking.id}` }
        ]]
      }
    };
    
    bot.sendMessage(chatId, bookingText, { parse_mode: 'Markdown', ...keyboard });
  });
  
  if (sortedBookings.length > 5) {
    bot.sendMessage(chatId, `... и еще ${sortedBookings.length - 5} записей`);
  }
}

function showDeleteServicesMenu(chatId) {
  if (db.services.length === 0) {
    bot.sendMessage(chatId, '📭 Услуг пока нет');
    return;
  }
  
  const keyboard = {
    reply_markup: {
      inline_keyboard: db.services.map(service => ([{
        text: `🗑 ${service.name}`,
        callback_data: `delete_service_${service.id}`
      }]))
    }
  };
  
  bot.sendMessage(chatId, 'Выберите услугу для удаления:', keyboard);
}

function showDeleteMastersMenu(chatId) {
  if (db.masters.length === 0) {
    bot.sendMessage(chatId, '📭 Мастеров пока нет');
    return;
  }
  
  const keyboard = {
    reply_markup: {
      inline_keyboard: db.masters.map(master => ([{
        text: `🗑 ${master.name}`,
        callback_data: `delete_master_${master.id}`
      }]))
    }
  };
  
  bot.sendMessage(chatId, 'Выберите мастера для удаления:', keyboard);
}

// Показать статистику
function showStats(chatId) {
  const today = moment().format('YYYY-MM-DD');
  const todayBookings = db.bookings.filter(b => b.date === today);
  
  const tomorrow = moment().add(1, 'days').format('YYYY-MM-DD');
  const tomorrowBookings = db.bookings.filter(b => b.date === tomorrow);
  
  // Статистика по мастерам
  const masterStats = {};
  db.masters.forEach(m => masterStats[m.name] = 0);
  db.bookings.forEach(b => {
    if (masterStats[b.master.name] !== undefined) {
      masterStats[b.master.name]++;
    }
  });
  
  let text = '📊 *СТАТИСТИКА*\n\n';
  text += `📅 Сегодня (${formatDateRussian(today)}): *${todayBookings.length}* записей\n`;
  text += `📅 Завтра (${formatDateRussian(tomorrow)}): *${tomorrowBookings.length}* записей\n`;
  text += `📊 Всего записей: *${db.bookings.length}*\n\n`;
  
  text += '*По мастерам:*\n';
  Object.entries(masterStats).forEach(([name, count]) => {
    text += `👨‍💼 ${name}: ${count} записей\n`;
  });
  
  bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
}

// Меню привязки мастера
function showLinkMasterMenu(chatId) {
  const keyboard = {
    reply_markup: {
      inline_keyboard: db.masters.map((master, index) => ([{
        text: `${master.name} ${master.chatId ? '✅' : '❌'}`,
        callback_data: `link_master_${master.id}`
      }]))
    }
  };
  
  let text = '👨‍💼 *Привязка мастера к Telegram*\n\n';
  text += 'Выберите мастера:\n';
  text += '✅ - уже привязан\n';
  text += '❌ - не привязан\n\n';
  text += 'Мастер должен написать боту команду /iammaster';
  
  bot.sendMessage(chatId, text, { parse_mode: 'Markdown', ...keyboard });
}

// Обработка удаления через callback
bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const data = query.data;
  
  if (data.startsWith('delete_service_')) {
    const serviceId = parseInt(data.split('_')[2]);
    db.services = db.services.filter(s => s.id !== serviceId);
    saveData(db);
    
    bot.answerCallbackQuery(query.id, { text: 'Услуга удалена!' });
    bot.deleteMessage(chatId, messageId);
    bot.sendMessage(chatId, '✅ Услуга успешно удалена');
  }
  
  if (data.startsWith('delete_master_')) {
    const masterId = parseInt(data.split('_')[2]);
    db.masters = db.masters.filter(m => m.id !== masterId);
    saveData(db);
    
    bot.answerCallbackQuery(query.id, { text: 'Мастер удален!' });
    bot.deleteMessage(chatId, messageId);
    bot.sendMessage(chatId, '✅ Мастер успешно удален');
  }
  
  if (data.startsWith('delete_booking_')) {
    const bookingId = parseInt(data.split('_')[2]);
    const bookingIndex = db.bookings.findIndex(b => b.id === bookingId);
    
    if (bookingIndex >= 0) {
      const booking = db.bookings[bookingIndex];
      db.bookings.splice(bookingIndex, 1);
      saveData(db);
      
      bot.answerCallbackQuery(query.id, { text: 'Запись удалена!' });
      bot.deleteMessage(chatId, messageId);
      bot.sendMessage(chatId, `✅ Запись на ${formatDateRussian(booking.date)} удалена`);
    }
  }
  
  if (data.startsWith('link_master_')) {
    const masterId = parseInt(data.split('_')[2]);
    const master = db.masters.find(m => m.id === masterId);
    
    if (master) {
      const status = master.chatId ? 'привязан' : 'не привязан';
      const emoji = master.chatId ? '✅' : '❌';
      bot.answerCallbackQuery(query.id, { text: `${master.name} - ${status}` });
      
      let text = `👨‍💼 *${master.name}*\n\n`;
      text += `Статус: ${emoji} ${status}\n\n`;
      if (!master.chatId) {
        text += 'Чтобы привязать мастера:\n';
        text += '1. Мастер должен написать боту: /iammaster\n';
        text += '2. Выбрать свой номер из списка';
      } else {
        text += 'Мастер уже получает уведомления!';
      }
      
      bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    }
  }
});

// ====== ЗАПУСК ======

console.log('🤖 Retro Barbershop Bot запущен!');
console.log('📱 Ожидание сообщений...');

// Обработка ошибок
bot.on('polling_error', (error) => {
  console.error('Ошибка polling:', error);
});

bot.on('error', (error) => {
  console.error('Ошибка бота:', error);
});
