const db = require('../src/lib/db');

module.exports = async (request, response) => {
    // Add CORS headers
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (request.method === 'OPTIONS') {
        return response.status(200).end();
    }

    const { action, collection, id, data, pin } = request.body || request.query;

    try {
        if (request.method === 'GET') {
            return response.status(200).json({
                services: db.getServices(),
                masters: db.getMasters(),
                settings: db.data.settings,
                bookings: db.getBookings()
            });
        }

        if (request.method === 'POST') {
            // Public action: add booking
            if (action === 'add_booking') {
                db.addBooking(data);
                return response.status(200).json({ success: true, bookings: db.getBookings() });
            }

            // Auth action
            if (action === 'admin_auth') {
                console.log('Admin auth attempt with PIN:', pin);
                if (pin === db.data.adminPin) {
                    return response.status(200).json({ success: true, message: 'Authenticated' });
                }
                console.log('Auth failed: Expected', db.data.adminPin, 'Got', pin);
                return response.status(401).json({ success: false, message: 'Invalid PIN' });
            }

            // Admin only actions
            if (pin !== db.data.adminPin) {
                return response.status(401).json({ error: 'Unauthorized' });
            }

            if (action === 'update_settings') {
                db.data.settings = data;
                db.save();
                return response.status(200).json({ success: true });
            }

            if (action === 'save_collection') {
                // Save entire collection (services or masters)
                db.data[collection] = data;
                db.save();
                return response.status(200).json({ success: true });
            }
        }

        response.status(405).send('Method Not Allowed');
    } catch (error) {
        console.error('API Error:', error);
        response.status(500).json({ error: error.message });
    }
};
