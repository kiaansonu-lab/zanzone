const mysql = require('mysql2/promise');

async function checkOldDB() {
    try {
        const conn = await mysql.createConnection({
            host: 'metro.proxy.rlwy.net',
            port: 18885,
            user: 'root',
            password: 'zmfywYMaqjYSlvEoXwkqOCXqIEpJKXPY',
            database: 'railway'
        });
        console.log('Successfully connected to OLD DB (metro)');
        const [cols] = await conn.query('DESCRIBE orders');
        console.log('Old Orders Table Structure:', cols[0]);
        await conn.end();
    } catch (err) {
        console.error('Failed to connect to OLD DB:', err.message);
    }
}

checkOldDB();
