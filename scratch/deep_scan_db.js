const db = require('../config/db');

async function checkAll() {
    try {
        const [tables] = await db.query('SHOW TABLES');
        const dbName = 'railway'; // based on .env
        const tableList = tables.map(t => Object.values(t)[0]);
        
        console.log(`Checking ${tableList.length} tables...`);
        
        for (const t of tableList) {
            const [cols] = await db.query(`DESCRIBE ${t}`);
            const idCol = cols.find(c => c.Field === 'id');
            if (idCol && idCol.Extra !== 'auto_increment') {
                console.log(`❌ Table ${t} is MISSING auto_increment on id.`);
            } else if (idCol) {
                // console.log(`✅ Table ${t} is OK.`);
            }
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkAll();
