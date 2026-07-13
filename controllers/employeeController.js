import Employee from '../models/Employee.js';
import User from '../models/User.js';

// GET /api/admin/staff — List all employees
export const getEmployees = async (req, res) => {
    try {
        const { search, department, status } = req.query;
        const filter = {};

        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { jobTitle: { $regex: search, $options: 'i' } },
                { employeeId: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
            ];
        }
        if (department) filter.department = department;
        if (status) filter.status = status;

        const employees = await Employee.find(filter).sort({ createdAt: -1 });
        
        // Auto-repair: Sync with User accounts
        for (const emp of employees) {
            if (!emp.user) {
                let user = await User.findOne({ email: emp.email.toLowerCase() });
                if (!user) {
                    const nameParts = (emp.name || '').trim().split(/\s+/);
                    const isReceptionist = (emp.jobTitle || '').toLowerCase().includes('receptionist') || 
                                          emp.department === 'Front Desk';
                    user = await User.create({
                        firstName: nameParts[0] || 'Staff',
                        lastName: nameParts.slice(1).join(' ') || 'Member',
                        email: emp.email.toLowerCase(),
                        password: emp.password || 'Temporary123!',
                        phone: emp.phone,
                        role: isReceptionist ? 'receptionist' : 'staff',
                        status: 'Active'
                    });
                } else {
                    const isReceptionist = (emp.jobTitle || '').toLowerCase().includes('receptionist') || 
                                          emp.department === 'Front Desk';
                    user.role = isReceptionist ? 'receptionist' : 'staff';
                    await user.save();
                }
                emp.user = user._id;
                await emp.save();
            }
        }

        res.json(employees);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// POST /api/admin/staff — Create employee
export const createEmployee = async (req, res) => {
    try {
        const { 
            name, email, phone, jobTitle, department, status, salary, hireDate, password,
            nic, address, dateOfBirth, emergencyContact, gender
        } = req.body;

        const exists = await Employee.findOne({ email: email.toLowerCase() });
        if (exists) {
            return res.status(400).json({ message: 'Employee with this email already exists' });
        }

        const nameParts = name.trim().split(/\s+/);
        const firstName = nameParts[0] || 'Staff';
        const lastName = nameParts.slice(1).join(' ') || 'Member';

        // Determine role
        const isReceptionist = jobTitle?.toLowerCase().includes('receptionist') || 
                              department === 'Front Desk';
        const assignedRole = isReceptionist ? 'receptionist' : 'staff';

        // Find or create User
        let user = await User.findOne({ email: email.toLowerCase() });
        if (user) {
            user.role = assignedRole;
            if (password) user.password = password;
            await user.save();
        } else {
            user = await User.create({
                firstName, lastName, email: email.toLowerCase(), password, phone, role: assignedRole
            });
        }

        const employee = await Employee.create({
            name, email: email.toLowerCase(), phone, jobTitle, department, status, salary, hireDate, password, 
            user: user._id,
            nic, address, dateOfBirth, emergencyContact, gender
        });

        res.status(201).json(employee);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// PUT /api/admin/staff/:id — Update employee
export const updateEmployee = async (req, res) => {
    try {
        const employee = await Employee.findById(req.params.id);
        if (!employee) return res.status(404).json({ message: 'Employee not found' });

        // Update fields
        const fields = [
            'name', 'email', 'phone', 'jobTitle', 'department', 'status', 'salary', 'hireDate', 
            'password', 'nic', 'address', 'dateOfBirth', 'emergencyContact', 'gender'
        ];
        fields.forEach(key => {
            if (req.body[key] !== undefined) {
                employee[key] = req.body[key];
            }
        });

        // Sync with User
        if (employee.user) {
            const user = await User.findById(employee.user);
            if (user) {
                if (req.body.name) {
                    const nameParts = req.body.name.trim().split(/\s+/);
                    user.firstName = nameParts[0];
                    user.lastName = nameParts.slice(1).join(' ') || 'Member';
                }
                if (req.body.email) user.email = req.body.email.toLowerCase();
                if (req.body.password) user.password = req.body.password;
                if (req.body.status) user.status = req.body.status === 'Terminated' ? 'Inactive' : 'Active';

                // Sync role if jobTitle or department changed
                if (req.body.jobTitle || req.body.department) {
                    const jt = req.body.jobTitle || employee.jobTitle;
                    const dept = req.body.department || employee.department;
                    const isRec = jt.toLowerCase().includes('receptionist') || dept === 'Front Desk';
                    user.role = isRec ? 'receptionist' : 'staff';
                }

                await user.save();
            }
        }

        await employee.save();
        res.json(employee);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// DELETE /api/admin/staff/:id — Delete employee
export const deleteEmployee = async (req, res) => {
    try {
        const employee = await Employee.findById(req.params.id);

        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        if (employee.user) {
            await User.findByIdAndDelete(employee.user);
        }

        await Employee.findByIdAndDelete(req.params.id);
        res.json({ message: 'Employee removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// GET /api/admin/staff/:id/qr — Get employee QR data
export const getEmployeeQR = async (req, res) => {
    try {
        const employee = await Employee.findById(req.params.id).select('employeeId name department jobTitle');

        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        res.json({
            qrData: employee.employeeId,
            employee: {
                employeeId: employee.employeeId,
                name: employee.name,
                department: employee.department,
                jobTitle: employee.jobTitle,
            },
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
