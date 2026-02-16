const bot = require('../src/index');

const VERSION = '1.0.3';

module.exports = async (request, response) => {
    console.log(`[Webhook v${VERSION}] Method: ${request.method}`);
    if (request.method === 'POST') {
        try {
            console.log('Incoming update:', JSON.stringify(request.body));

            if (!request.body || Object.keys(request.body).length === 0) {
                console.warn('Empty request body received');
                return response.status(200).send('Empty body');
            }

            // Process the update from Telegram
            bot.processUpdate(request.body);

            // Wait for a short duration to ensure bot handles the message before termination
            await new Promise(resolve => setTimeout(resolve, 2000));

            response.status(200).send('OK');
        } catch (error) {
            console.error('Error processing update:', error);
            response.status(500).send('Error');
        }
    } else {
        response.status(200).send('Bot is running');
    }
};
