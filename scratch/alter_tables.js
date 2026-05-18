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
        console.log('Running schema upgrades...');
        await addColumnIfMissing('deliveries', 'client_id', 'INT NULL');
        await addColumnIfMissing('deliveries', 'created_by', 'INT NULL');
        
        await addColumnIfMissing('luxury_items', 'client_id', 'INT NULL');
        await addColumnIfMissing('luxury_items', 'created_by', 'INT NULL');
        console.log('Schema upgrades complete.');
    } catch (e) {
        console.error('Error upgrading schema:', e);
    } finally {
        process.exit(0);
    }
}
main();
