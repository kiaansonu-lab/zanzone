const db = require('../config/db');

async function checkUsers() {
    try {
        const [users] = await db.query('SELECT id, email, password, role FROM users LIMIT 10');
        console.log('Sample Users:', users);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkUsers();
