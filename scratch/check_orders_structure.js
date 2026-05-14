const db = require('../config/db');

async function checkOrders() {
    try {
        const [cols] = await db.query('DESCRIBE orders');
        console.log('Orders Table Structure:', cols);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkOrders();
