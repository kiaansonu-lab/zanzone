const db = require('../config/db');
const bcrypt = require('bcryptjs');

async function resetPasswords() {
    try {
        const newPassword = '123456';
        const hashedPassword = await bcrypt.hash(newPassword, 12);
        
        console.log(`Resetting all user passwords to: ${newPassword}`);
        console.log(`Hashed Password: ${hashedPassword}`);

        const [result] = await db.query('UPDATE users SET password = ?', [hashedPassword]);
        
        console.log(`Successfully updated ${result.affectedRows} users.`);
        process.exit(0);
    } catch (err) {
        console.error('Password reset failed:', err);
        process.exit(1);
    }
}

resetPasswords();
