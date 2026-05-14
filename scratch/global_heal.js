const db = require('../config/db');

async function healAll() {
    try {
        console.log('--- GLOBAL DATABASE HEALING ---');
        const tables = [
            'users', 'orders', 'deliveries', 'vehicles', 'missions', 
            'inventory', 'luxury_items', 'support_tickets', 'guest_requests',
            'events', 'vendors', 'purchase_requests', 'quotes', 'purchase_orders',
            'warehouses', 'logistics_tracking', 'logistics_urgent_tasks', 'routes',
            'delivery_pricing', 'order_flow_logs', 'notifications', 'saas_requests',
            'audits', 'menus', 'roles', 'role_menus', 'system_logs', 'messages'
        ];

        for (const t of tables) {
            try {
                console.log(`Processing table: ${t}...`);
                const [cols] = await db.query(`DESCRIBE ${t}`);
                const idCol = cols.find(c => c.Field === 'id');
                
                if (!idCol) {
                    console.log(`  - No id column found in ${t}. Skipping.`);
                    continue;
                }

                // 1. Add Primary Key if missing
                const [keys] = await db.query(`SHOW KEYS FROM ${t} WHERE Key_name = "PRIMARY"`);
                if (keys.length === 0) {
                    await db.query(`ALTER TABLE ${t} ADD PRIMARY KEY (id)`);
                    console.log(`  - Added Primary Key to ${t}.`);
                }

                // 2. Enable AUTO_INCREMENT
                if (idCol.Extra !== 'auto_increment') {
                    // We need to keep the type consistent. Most are INT.
                    const type = idCol.Type;
                    await db.query(`ALTER TABLE ${t} MODIFY COLUMN id ${type} AUTO_INCREMENT`);
                    console.log(`  - Enabled AUTO_INCREMENT for ${t}.id.`);
                }
            } catch (tableErr) {
                console.error(`  ❌ Failed to process table ${t}:`, tableErr.message);
            }
        }

        console.log('--- GLOBAL HEALING COMPLETE ---');
        process.exit(0);
    } catch (err) {
        console.error('Global heal failed:', err.message);
        process.exit(1);
    }
}

healAll();
