const bot = require('../src/index');

export default async function handler(request, response) {
    if (request.method === 'POST') {
        try {
            console.log('Incoming update:', JSON.stringify(request.body));

            // Process the update from Telegram
            bot.processUpdate(request.body);

            // Wait for a short duration to ensure bot handles the message before termination
            await new Promise(resolve => setTimeout(resolve, 1500));

            response.status(200).send('OK');
        } catch (error) {
            console.error('Error processing update:', error);
            response.status(500).send('Error');
        }
    } else {
        response.status(200).send('Bot is running');
    }
}
