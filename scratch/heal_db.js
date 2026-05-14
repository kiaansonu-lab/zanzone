const db = require('../config/db');

async function heal() {
    try {
        console.log('--- Healing Database Schema ---');

        // 1. Fix Companies table
        console.log('Fixing companies table...');
        // Check if primary key exists
        const [compKeys] = await db.query('SHOW KEYS FROM companies WHERE Key_name = "PRIMARY"');
        if (compKeys.length === 0) {
            await db.query('ALTER TABLE companies ADD PRIMARY KEY (id)');
            console.log('Added Primary Key to companies.');
        }
        await db.query('ALTER TABLE companies MODIFY COLUMN id INT AUTO_INCREMENT');
        console.log('Enabled AUTO_INCREMENT for companies.id.');

        // 2. Fix Customers table
        console.log('Fixing customers table...');
        const [custKeys] = await db.query('SHOW KEYS FROM customers WHERE Key_name = "PRIMARY"');
        if (custKeys.length === 0) {
            await db.query('ALTER TABLE customers ADD PRIMARY KEY (id)');
            console.log('Added Primary Key to customers.');
        }
        await db.query('ALTER TABLE customers MODIFY COLUMN id INT AUTO_INCREMENT');
        console.log('Enabled AUTO_INCREMENT for customers.id.');

        console.log('--- Healing Complete ---');
        process.exit(0);
    } catch (err) {
        console.error('Heal failed:', err.message);
        process.exit(1);
    }
}

heal();
