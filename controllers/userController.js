const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { companyFilter, companyScope } = require('../middleware/company');
const { successResponse, errorResponse } = require('../utils/helpers');
const { createNotification } = require('./notificationController');

// GET /api/users/customers — returns users with role='customer' for order dropdowns
exports.getCustomers = async (req, res) => {
    try {
        // Default use-case is order dropdown: active customer-role users only.
        // Admin customer management can pass query flags to include wider result sets.
        const companyId = req.companyScope; // null for super_admin
        const includeAll = String(req.query?.include_all || '').toLowerCase() === '1' || String(req.query?.include_all || '').toLowerCase() === 'true';
        const includeClientRole = String(req.query?.include_client_role || '').toLowerCase() === '1' || String(req.query?.include_client_role || '').toLowerCase() === 'true';

        let query = `SELECT id, name, email, phone, role, status, company_id, plan, concierge_member, concierge_membership_since, is_upgraded
                     FROM users WHERE role IN (${includeClientRole ? "'customer','client','business_client'" : "'customer'"})`;
        const params = [];

        if (!includeAll) {
            query += ` AND LOWER(COALESCE(status, 'active')) = 'active'`;
        }

        const roleNorm = String(req.user?.role || '').toLowerCase().replace(/\s+/g, '_');
        const isHQ = (req.user?.company_id == 1 || !req.user?.company_id || req.companyScope == 1);

        if (companyId) {
            if (roleNorm === 'admin' && isHQ) {
                query += ' AND (company_id = ? OR company_id IS NULL) AND (created_by = ? OR created_by IS NULL)';
                params.push(companyId, req.user.id);
            } else {
                query += ' AND (company_id = ? OR company_id IS NULL)';
                params.push(companyId);
            }
        }
        query += ' ORDER BY name ASC';

        const [rows] = await db.query(query, params);
        return successResponse(res, rows);
    } catch (err) {
        return errorResponse(res, 'Failed to fetch customers.', 500);
    }
};

// GET /api/users
exports.getAll = async (req, res) => {
    try {
        const roleNorm = String(req.user.role || '').toLowerCase().replace(/\s+/g, '_');
        const isSuperAdmin = ['super_admin', 'superadmin'].includes(roleNorm.replace(/\s+/g, '')) || ['super_admin', 'superadmin'].includes(roleNorm);
        const isHQ = (req.user.company_id == 1 || !req.user.company_id || req.companyScope == 1);

        // HQ admins see only their own created users, Super Admins see ALL, non-admins see ONLY themselves
        let cf;
        if (isSuperAdmin) {
            cf = { clause: '', params: [] };
        } else if ((roleNorm === 'admin' || roleNorm === 'manager') && isHQ) {
            cf = { clause: ' AND (u.created_by = ? OR u.id = ?)', params: [req.user.id, req.user.id] };
        } else if (roleNorm === 'admin' || roleNorm === 'manager') {
            cf = companyFilter(req);
        } else {
            cf = { clause: ' AND u.id = ?', params: [req.user.id] };
        }

        const qStatus = String(req.query?.status || '').toLowerCase().trim();
        const qSearch = String(req.query?.search || '').toLowerCase().trim();
        // Non-superadmin: exclude only customer roles (they are managed separately)
        const excludeRoles = !isSuperAdmin ? " AND u.role NOT IN ('customer')" : '';
        const statusClause = qStatus ? ' AND LOWER(COALESCE(u.status, \'\')) = ?' : '';
        const searchClause = qSearch ? ' AND (LOWER(COALESCE(u.name, \'\')) LIKE ? OR LOWER(COALESCE(u.email, \'\')) LIKE ?)' : '';
        const queryParams = [...cf.params];
        if (qStatus) queryParams.push(qStatus);
        if (qSearch) {
            const like = `%${qSearch}%`;
            queryParams.push(like, like);
        }
        const [rows] = await db.query(
            `SELECT u.id, u.company_id, u.name, u.email, u.phone, u.role,
                    u.is_available, u.employment_status, u.status, u.joined_date,
                    u.profile_pic_url, u.birthday, u.bank_name, u.account_number,
                    u.routing_number, u.nib_number, u.vacation_balance,
                    u.plan, u.is_upgraded, u.concierge_member, u.concierge_membership_since,
                    u.passport_url, u.license_url, u.nib_doc_url, u.police_record_url,
                    u.business_license_url, c.name as company_name, c.client_type, c.tenant_type
             FROM users u LEFT JOIN companies c ON u.company_id = c.id
             WHERE 1=1 ${cf.clause}${excludeRoles}${statusClause}${searchClause} ORDER BY u.created_at DESC`,
            queryParams
        );
        return successResponse(res, rows);
    } catch (err) {
        return errorResponse(res, 'Failed to fetch users.', 500);
    }
};

// GET /api/users/:id
exports.getById = async (req, res) => {
    try {
        const roleNorm = String(req.user?.role || '').toLowerCase().replace(/\s+/g, '_');
        const isSuperAdmin = ['super_admin', 'superadmin'].includes(roleNorm);
        const isHQ = (req.user?.company_id == 1 || !req.user?.company_id || req.companyScope == 1);

        let cs;
        if (isSuperAdmin) {
            cs = { clause: '', params: [] };
        } else if ((roleNorm === 'admin' || roleNorm === 'manager') && isHQ) {
            cs = { clause: ' AND (u.created_by = ? OR u.id = ?)', params: [req.user.id, req.user.id] };
        } else if (roleNorm === 'admin' || roleNorm === 'manager') {
            cs = companyScope(req, 'u');
        } else {
            cs = { clause: ' AND u.id = ?', params: [req.user.id] };
        }

        const [rows] = await db.query(
            `SELECT u.*, c.name as company_name FROM users u LEFT JOIN companies c ON u.company_id = c.id WHERE u.id = ?${cs.clause}`,
            [req.params.id, ...cs.params]
        );
        if (rows.length === 0) return errorResponse(res, 'User not found.', 404);
        delete rows[0].password;
        return successResponse(res, rows[0]);
    } catch (err) {
        return errorResponse(res, 'Failed to fetch user.', 500);
    }
};

// POST /api/users
exports.create = async (req, res) => {
    try {
        const body = { ...req.body };
        const { name, email, password, phone, company_id, employment_status, status } = body;

        if (!name || !email || !password) return errorResponse(res, 'Name, email, password required.', 400);

        const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) return errorResponse(res, 'Email already exists.', 409);

        const hashedPassword = await bcrypt.hash(password, 12);

        const normalizeCompanyId = (value) => {
            if (value == null) return null;
            if (typeof value === 'string' && value.trim() === '') return null;
            const n = Number(value);
            if (!Number.isFinite(n) || Number.isNaN(n) || n <= 0) return null;
            return n;
        };

        const normalizedRole = String(req.user?.role || '').toLowerCase().trim().replace(/\s+/g, '_');
        const isSuperAdmin = ['super_admin', 'superadmin'].includes(normalizedRole);
        const requestedCompanyId = normalizeCompanyId(company_id ?? body.companyId);
        const scopedCompanyId = normalizeCompanyId(req.companyScope);
        const isHQ = (req.user?.company_id == 1 || !req.user?.company_id || req.companyScope == 1);
        let assignedCompany = isSuperAdmin ? requestedCompanyId : (scopedCompanyId || requestedCompanyId);

        // If it's HQ (ID 1), we use NULL to satisfy foreign key constraints if ID 1 doesn't exist in companies table
        if (assignedCompany == 1) assignedCompany = null;

        if (assignedCompany != null) {
            const [companyRows] = await db.query('SELECT id FROM companies WHERE id = ? LIMIT 1', [assignedCompany]);
            if (!companyRows.length) {
                return errorResponse(res, 'Invalid company_id. Select a valid workspace/company first.', 400);
            }
        }

        // Normalize role
        const roleMap = {
            'operations': 'operation', 'ops': 'operation',
            'field_staff': 'staff', 'field staff': 'staff',
            'staff_management': 'admin', 'client_admin': 'admin'
        };
        let targetRole = (body.role || 'staff').toLowerCase().trim().replace(/\s+/g, '_');
        targetRole = roleMap[targetRole] || (targetRole.includes('staff') ? 'staff' : targetRole);

        // Flatten bankingInfo → DB columns
        let bank_name = null, account_number = null, routing_number = null;
        if (body.bankingInfo && typeof body.bankingInfo === 'object') {
            bank_name      = body.bankingInfo.bank    || null;
            account_number = body.bankingInfo.account || null;
            routing_number = body.bankingInfo.routing || null;
        }

        // camelCase → snake_case
        const birthday         = body.birthday        || null;
        const nib_number       = body.nibNumber       || body.nib_number       || null;
        const vacation_balance = body.vacationBalance !== undefined ? body.vacationBalance
                               : (body.vacation_balance !== undefined ? body.vacation_balance : 0);

        const [result] = await db.query(
            `INSERT INTO users
             (name, email, password, phone, role, company_id, created_by, employment_status, status,
              birthday, bank_name, account_number, routing_number, nib_number, vacation_balance)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                name, email, hashedPassword, phone || null,
                targetRole, assignedCompany, req.user.id,
                employment_status || 'Full Time', status || 'active',
                birthday, bank_name, account_number, routing_number, nib_number, vacation_balance
            ]
        );

        await createNotification({
            companyId: assignedCompany,
            roleTarget: 'admin',
            type: 'alert',
            title: 'New Staff Added',
            message: `${name} joined as ${targetRole}`,
            link: '/dashboard/users'
        });

        return successResponse(res, { id: result.insertId, name, email, role: targetRole }, 'User created.', 201);
    } catch (err) {
        console.error('Create user failed:', err.message, err.stack);
        return errorResponse(res, `Failed to create user: ${err.message}`, 500);
    }
};

// PUT /api/users/:id
exports.update = async (req, res) => {
    try {
        const body = { ...req.body };
        const roleNorm = String(req.user?.role || '').toLowerCase().replace(/\s+/g, '_');
        const isSuperAdmin = ['super_admin', 'superadmin'].includes(roleNorm);
        const isHQ = (req.user?.company_id == 1 || !req.user?.company_id || req.companyScope == 1);
        const isSelf = String(req.user.id) === String(req.params.id);

        // Authorization check: must be super_admin, admin/manager, or updating own profile
        if (!isSelf && !isSuperAdmin && !(roleNorm === 'admin' || roleNorm === 'manager')) {
            return errorResponse(res, 'Access denied.', 403);
        }

        // Automatic plan/membership upgrade persistence
        // Save to BOTH company (if exists) AND user row (for personal accounts with no company)
        if (body.plan || body.concierge_member !== undefined || body.is_upgraded !== undefined) {
            const [userRows] = await db.query('SELECT company_id FROM users WHERE id = ?', [req.params.id]);
            const newPlan = body.plan || 'Premium';
            // Update company plan if user has a company
            if (userRows.length > 0 && userRows[0].company_id) {
                const companyId = userRows[0].company_id;
                await db.query('UPDATE companies SET plan = ? WHERE id = ?', [newPlan, companyId]);
                console.log(`  ✅ Updated company ID ${companyId} plan to ${newPlan}`);
            }
            // Always update user row directly (critical for personal accounts with no company)
            const memberSets = [];
            const memberVals = [];
            if (body.plan) { memberSets.push('plan = ?'); memberVals.push(body.plan); }
            if (body.is_upgraded !== undefined) { memberSets.push('is_upgraded = ?'); memberVals.push(body.is_upgraded ? 1 : 0); }
            if (body.concierge_member !== undefined) { memberSets.push('concierge_member = ?'); memberVals.push(body.concierge_member ? 1 : 0); }
            if (body.concierge_member) { memberSets.push('concierge_membership_since = COALESCE(concierge_membership_since, CURDATE())'); }
            if (body.concierge_member === false) { memberSets.push('concierge_membership_since = NULL'); }
            if (memberSets.length > 0) {
                memberVals.push(req.params.id);
                await db.query(`UPDATE users SET ${memberSets.join(', ')} WHERE id = ?`, memberVals);
                console.log(`  ✅ Updated user ID ${req.params.id} membership fields directly`);
            }
        }

        // Flatten bankingInfo nested object → individual DB columns
        if (body.bankingInfo && typeof body.bankingInfo === 'object') {
            if (body.bankingInfo.bank)    body.bank_name       = body.bankingInfo.bank;
            if (body.bankingInfo.account) body.account_number  = body.bankingInfo.account;
            if (body.bankingInfo.routing) body.routing_number  = body.bankingInfo.routing;
            delete body.bankingInfo;
        }

        // Map frontend camelCase → DB snake_case
        if (body.nibNumber !== undefined)       body.nib_number      = body.nibNumber;
        if (body.vacationBalance !== undefined)  body.vacation_balance = body.vacationBalance;
        if (body.employmentStatus !== undefined) body.employment_status = body.employmentStatus;

        // Normalize role
        if (body.role) {
            const roleMap = {
                'operations': 'operation', 'ops': 'operation',
                'field_staff': 'staff', 'field staff': 'staff',
                'staff_management': 'admin', 'client_admin': 'admin'
            };
            const r = body.role.toLowerCase().trim().replace(/\s+/g, '_');
            body.role = roleMap[r] || (r.includes('staff') ? 'staff' : r);
        }

        const allowedColumns = [
            'name', 'email', 'phone', 'role', 'company_id', 'employment_status',
            'is_available', 'status', 'joined_date', 'profile_pic_url', 'password',
            'birthday', 'bank_name', 'account_number', 'routing_number',
            'nib_number', 'vacation_balance',
            'plan', 'is_upgraded', 'concierge_member', 'concierge_membership_since'
        ];

        const sets = [];
        const values = [];

        for (const [key, val] of Object.entries(body)) {
            if (!allowedColumns.includes(key)) continue;
            if (['id', 'created_at'].includes(key)) continue;

            if (key === 'password') {
                if (val && String(val).length >= 6) {
                    sets.push('password = ?');
                    values.push(await bcrypt.hash(val, 12));
                }
            } else {
                sets.push(`${key} = ?`);
                values.push(val === '' ? null : val);
            }
        }

        if (sets.length === 0 && !body.plan && !body.concierge_member && !body.is_upgraded) {
            return errorResponse(res, 'No fields to update.', 400);
        }

        let cs;
        if (isSuperAdmin) {
            cs = { clause: '', params: [] };
        } else if (isSelf) {
            cs = { clause: '', params: [] };
        } else if (isHQ) {
            cs = { clause: ' AND (u.created_by = ? OR u.id = ?)', params: [req.user.id, req.user.id] };
        } else {
            cs = companyScope(req, 'u');
        }

        if (sets.length > 0) {
            values.push(req.params.id, ...cs.params);
            await db.query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?${cs.clause}`, values);
        }
        const [updatedRows] = await db.query(
            `SELECT u.id, u.company_id, u.name, u.email, u.phone, u.role,
                    u.is_available, u.employment_status, u.status, u.joined_date,
                    u.profile_pic_url, u.birthday, u.bank_name, u.account_number,
                    u.routing_number, u.nib_number, u.vacation_balance,
                    u.plan, u.is_upgraded, u.concierge_member, u.concierge_membership_since,
                    u.passport_url, u.license_url, u.nib_doc_url, u.police_record_url,
                    u.business_license_url, c.name as company_name, c.client_type, c.tenant_type
             FROM users u LEFT JOIN companies c ON u.company_id = c.id
             WHERE u.id = ?${cs.clause} LIMIT 1`,
            [req.params.id, ...cs.params]
        );
        return successResponse(res, updatedRows[0] || { id: req.params.id }, 'User updated.');
    } catch (err) {
        console.error('Update user failed:', err.message);
        return errorResponse(res, `Failed to update user: ${err.message}`, 500);
    }
};

// DELETE /api/users/:id
exports.remove = async (req, res) => {
    try {
        const roleNorm = String(req.user?.role || '').toLowerCase().replace(/\s+/g, '_');
        const isSuperAdmin = ['super_admin', 'superadmin'].includes(roleNorm);
        const isHQ = (req.user?.company_id == 1 || !req.user?.company_id || req.companyScope == 1);
        
        let cs;
        if (isSuperAdmin) {
            cs = { clause: '', params: [] };
        } else if (isHQ) {
            cs = { clause: ' AND (u.created_by = ? OR u.id = ?)', params: [req.user.id, req.user.id] };
        } else {
            cs = companyScope(req, 'u');
        }

        await db.query(`DELETE FROM users WHERE id = ?${cs.clause}`, [req.params.id, ...cs.params]);
        return successResponse(res, null, 'User deleted.');
    } catch (err) {
        return errorResponse(res, 'Failed to delete user.', 500);
    }
};

// PUT /api/users/:id/review  — Approve or reject pending staff/user within tenant
exports.review = async (req, res) => {
    try {
        const { status } = req.body; // 'active' or 'rejected'
        if (!['active', 'rejected'].includes(status)) {
            return errorResponse(res, 'Status must be "active" or "rejected".', 400);
        }
        const roleNorm = String(req.user?.role || '').toLowerCase().replace(/\s+/g, '_');
        const isSuperAdmin = ['super_admin', 'superadmin'].includes(roleNorm);
        const isHQ = (req.user?.company_id == 1 || !req.user?.company_id || req.companyScope == 1);
        
        let cs;
        if (isSuperAdmin || (roleNorm === 'admin' && isHQ)) {
            cs = { clause: '', params: [] };
        } else {
            cs = companyScope(req);
        }

        await db.query(
            `UPDATE users SET status = ? WHERE id = ?${cs.clause}`,
            [status, req.params.id, ...cs.params]
        );
        return successResponse(res, { id: req.params.id, status }, 'User status updated.');
    } catch (err) {
        return errorResponse(res, 'Failed to update user status.', 500);
    }
};
