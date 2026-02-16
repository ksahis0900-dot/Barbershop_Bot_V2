const bot = require('../src/index');

export default async function handler(request, response) {
    if (request.method === 'POST') {
        try {
            // Process the update from Telegram
            bot.processUpdate(request.body);
            response.status(200).send('OK');
        } catch (error) {
            console.error('Error processing update:', error);
            response.status(500).send('Error');
        }
    } else {
        response.status(200).send('Bot is running');
    }
}
