const db = require('../config/db');

async function check() {
    try {
        const tables = ['users', 'orders', 'deliveries', 'vehicles', 'missions', 'inventory', 'luxury_items', 'support_tickets', 'guest_requests'];
        for (const t of tables) {
            const [cols] = await db.query(`DESCRIBE ${t}`);
            const idCol = cols.find(c => c.Field === 'id');
            if (idCol) {
                console.log(`Table ${t}: Key=${idCol.Key}, Extra=${idCol.Extra}`);
            }
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
