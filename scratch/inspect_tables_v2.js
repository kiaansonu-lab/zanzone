const db = require('../config/db');

async function inspect() {
    try {
        const [companies] = await db.query('DESCRIBE companies');
        console.log('Companies Table Structure:', companies);

        const [customers] = await db.query('DESCRIBE customers');
        console.log('Customers Table Structure:', customers);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

inspect();
