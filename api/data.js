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
            // Publicly accessible data
            return response.status(200).json({
                services: db.getServices(),
                masters: db.getMasters(),
                settings: db.data.settings,
                bookings: db.getBookings() // For admin/validation
            });
        }

        if (request.method === 'POST') {
            // Actions requiring auth 
            if (action === 'admin_auth') {
                if (pin === db.data.adminPin) {
                    return response.status(200).json({ success: true });
                }
                return response.status(401).json({ success: false, message: 'Invalid PIN' });
            }

            // CRUD operations (Admin only)
            if (pin !== db.data.adminPin) {
                return response.status(401).json({ error: 'Unauthorized' });
            }

            if (action === 'update_collection') {
                db.data[collection] = data;
                db.save();
                return response.status(200).json({ success: true });
            }

            if (action === 'update_settings') {
                db.data.settings = data;
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
