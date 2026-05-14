const db = require('../config/db');

async function finalHeal() {
    try {
        console.log('--- FINAL COMPREHENSIVE HEALING ---');
        const tables = [
            'audit_logs', 'inventory_movements', 'invoices', 'leave_requests',
            'menu_permissions', 'order_items', 'password_resets', 'payments',
            'payroll', 'projects', 'saas_plans', 'shifts', 'staff_assignments',
            'system_settings'
        ];

        for (const t of tables) {
            try {
                console.log(`Fixing table: ${t}...`);
                const [cols] = await db.query(`DESCRIBE ${t}`);
                const idCol = cols.find(c => c.Field === 'id');
                
                if (!idCol) continue;

                const [keys] = await db.query(`SHOW KEYS FROM ${t} WHERE Key_name = "PRIMARY"`);
                if (keys.length === 0) {
                    await db.query(`ALTER TABLE ${t} ADD PRIMARY KEY (id)`);
                }

                const type = idCol.Type;
                await db.query(`ALTER TABLE ${t} MODIFY COLUMN id ${type} AUTO_INCREMENT`);
                console.log(`  ✅ ${t} fixed.`);
            } catch (err) {
                console.error(`  ❌ Failed ${t}: ${err.message}`);
            }
        }
        console.log('--- ALL TABLES HEALED ---');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

finalHeal();
