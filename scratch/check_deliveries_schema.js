const db = require('../config/db');

async function main() {
    try {
        const tables = ['deliveries', 'luxury_items', 'guest_requests', 'support_tickets', 'events', 'audit_logs'];
        for (const table of tables) {
            const [cols] = await db.query(`SHOW COLUMNS FROM ${table}`);
            console.log(`=== Columns of ${table} ===`);
            cols.forEach(c => console.log(` - ${c.Field}: ${c.Type} (Null: ${c.Null}, Key: ${c.Key})`));
        }
    } catch (e) {
        console.error('Error:', e);
    } finally {
        process.exit(0);
    }
}
main();
