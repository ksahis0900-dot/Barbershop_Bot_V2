const TelegramBot = require('node-telegram-bot-api');

/**
 * A wrapper for TelegramBot that adds error handling and logging to common methods
 */
class SafeBot extends TelegramBot {
    constructor(token, options) {
        super(token, options);
    }

    async safeSendMessage(chatId, text, options = {}) {
        try {
            return await this.sendMessage(chatId, text, options);
        } catch (error) {
            console.error(`[Bot Error] sendMessage failed for ${chatId}:`, error.message);
            if (error.code === 'ETELEGRAM' && error.response && error.response.body) {
                console.error('Telegram details:', error.response.body.description);
            }
            return null;
        }
    }

    async safeEditMessageText(text, options = {}) {
        try {
            return await this.editMessageText(text, options);
        } catch (error) {
            // Check if message is not modified - often happens if user clicks twice
            if (error.message.includes('message is not modified')) {
                return null;
            }
            console.error(`[Bot Error] editMessageText failed:`, error.message);
            return null;
        }
    }

    async safeDeleteMessage(chatId, messageId) {
        try {
            return await this.deleteMessage(chatId, messageId);
        } catch (error) {
            console.error(`[Bot Error] deleteMessage failed:`, error.message);
            return null;
        }
    }

    async safeAnswerCallbackQuery(callbackQueryId, options = {}) {
        try {
            return await this.answerCallbackQuery(callbackQueryId, options);
        } catch (error) {
            console.error(`[Bot Error] answerCallbackQuery failed:`, error.message);
            return null;
        }
    }
}

module.exports = SafeBot;
