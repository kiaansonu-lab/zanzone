const db = require('../config/db');

async function addColumnIfMissing(table, column, definition) {
    const [cols] = await db.query(`SHOW COLUMNS FROM ${table} LIKE '${column}'`);
    if (cols.length === 0) {
        await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
        console.log(`✅ Added "${column}" to ${table}`);
    } else {
        console.log(`ℹ️ Column "${column}" already exists in ${table}`);
    }
}

async function main() {
    try {
        console.log('Adding membership columns to users table...');
        await addColumnIfMissing('users', 'plan', "VARCHAR(100) DEFAULT 'Free'");
        await addColumnIfMissing('users', 'is_upgraded', 'BOOLEAN DEFAULT FALSE');
        await addColumnIfMissing('users', 'concierge_member', 'BOOLEAN DEFAULT FALSE');
        await addColumnIfMissing('users', 'concierge_membership_since', 'DATE NULL');
        console.log('Done!');
    } catch (e) {
        console.error('Error:', e);
    } finally {
        process.exit(0);
    }
}
main();
