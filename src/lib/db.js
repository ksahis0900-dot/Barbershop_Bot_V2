const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../../data/database.json');

class Database {
    constructor() {
        this.data = this.load();
    }

    load() {
        try {
            if (fs.existsSync(DATA_FILE)) {
                return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            }
        } catch (error) {
            console.error('Error loading DB:', error);
        }
        return { services: [], masters: [], bookings: [], users: {} };
    }

    save() {
        try {
            // NOTE: On Vercel this will NOT persist. 
            // This is a placeholder for Supabase/Mongo integration.
            fs.writeFileSync(DATA_FILE, JSON.stringify(this.data, null, 2));
        } catch (error) {
            console.error('Error saving DB:', error);
        }
    }

    getServices() {
        return this.data.services || [];
    }

    getMasters() {
        return this.data.masters || [];
    }

    getBookings() {
        return this.data.bookings || [];
    }

    addBooking(booking) {
        this.data.bookings.push(booking);
        this.save();
        return booking;
    }

    getUserState(chatId) {
        return this.data.users[chatId] || null;
    }

    setUserState(chatId, state) {
        this.data.users[chatId] = state;
        this.save();
    }

    clearUserState(chatId) {
        delete this.data.users[chatId];
        this.save();
    }
}

module.exports = new Database();
