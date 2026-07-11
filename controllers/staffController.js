import Staff from '../models/Staff.js';
import User from '../models/User.js';

const isValidEmergencyContact = (value) => /^(?:[A-Za-z][A-Za-z\s.'-]{1,}\s*-\s*)?0\d{9}$/.test((value || '').trim());
const isDuplicateKeyError = (error) => error?.code === 11000;
const getDuplicateMessage = (error) => {
    if (error?.keyPattern?.nic || error?.keyValue?.nic) {
        return 'NIC already exists';
    }
    if (error?.keyPattern?.email || error?.keyValue?.email) {
        return 'Email already exists';
    }
    return 'Employee already exists';
};


export const getStaff = async (req, res) => {
    try {
        const { status, department, search } = req.query;
        const query = {};

        if (status && status !== 'all') query.status = status;
        if (department && department !== 'all') query.department = department;
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { jobTitle: { $regex: search, $options: 'i' } },
            ];
        }

        const staff = await Staff.find(query).sort({ createdAt: -1 });
        
        // Auto-repair: check for staff without users
        for (const s of staff) {
            if (!s.user) {
                let user = await User.findOne({ email: s.email.toLowerCase() });
                if (!user) {
                    const nameParts = (s.name || '').split(' ');
                    const isAlreadyHashed = s.password && s.password.startsWith('$2a$');
                    
                    const isReceptionist = s.jobTitle?.toLowerCase().includes('receptionist') || 
                                          s.department === 'Front Desk';
                    
                    user = new User({
                        firstName: nameParts[0] || 'Staff',
                        lastName: nameParts.slice(1).join(' ') || 'Member',
                        email: s.email.toLowerCase(),
                        phone: s.phone,
                        role: isReceptionist ? 'receptionist' : 'staff',
                        status: 'Active'
                    });

                    if (isAlreadyHashed) {
                        // If it's already hashed, we need to bypass the pre-save hook hashing
                        // The safest way is to just set it and not use .save() for a new doc
                        // but that's hard. So we'll just set it to a temp password and ask to reset.
                        user.password = 'ResetMe123!'; 
                    } else {
                        user.password = s.password || 'ResetMe123!';
                    }
                    await user.save();
                } else {
                    const isReceptionist = s.jobTitle?.toLowerCase().includes('receptionist') || 
                                          s.department === 'Front Desk';
                    user.role = isReceptionist ? 'receptionist' : 'staff';
                    await user.save();
                }
                s.user = user._id;
                await s.save();
            }
        }

        res.json(staff);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


export const getStaffById = async (req, res) => {
    try {
        const staff = await Staff.findById(req.params.id);
        if (!staff) return res.status(404).json({ message: 'Staff member not found' });
        res.json(staff);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const createStaff = async (req, res) => {
    try {
        const email = req.body.email?.toLowerCase();
        const emergencyContact = (req.body.emergencyContact || '').trim();
        const exists = await Staff.findOne({ email });
        if (exists) {
            return res.status(400).json({ message: 'Staff with this email already exists' });
        }

        if (!emergencyContact) {
            return res.status(400).json({ message: 'Emergency contact is required' });
        }

        if (!isValidEmergencyContact(emergencyContact)) {
            return res.status(400).json({ message: 'Emergency contact must be a 10-digit number or a name with number, e.g. John Doe - 0712345678' });
        }

        // Split name for User model
        const nameParts = req.body.name.split(' ');
        const firstName = nameParts[0] || 'Staff';
        const lastName = nameParts.slice(1).join(' ') || 'Member';

        // Find or create User account
        let user = await User.findOne({ email });
        
        // Determine role based on job title or department
        const isReceptionist = req.body.jobTitle?.toLowerCase().includes('receptionist') || 
                              req.body.department === 'Front Desk';
        const assignedRole = isReceptionist ? 'receptionist' : 'staff';

        if (user) {
            // If user exists, update role and info
            user.role = assignedRole;
            if (req.body.password && req.body.password.trim() !== '') {
                user.password = req.body.password;
            }
            if (req.body.phone) user.phone = req.body.phone;
            user.status = 'Active';
            await user.save();
        } else {
            // Create new User account
            user = await User.create({
                firstName,
                lastName,
                email,
                password: req.body.password,
                phone: req.body.phone,
                role: assignedRole,
                status: 'Active'
            });
        }

        const staff = await Staff.create({
            ...req.body,
            email,
            emergencyContact,
            user: user._id
        });

        res.status(201).json(staff);
    } catch (error) {
        if (isDuplicateKeyError(error)) {
            return res.status(400).json({ message: getDuplicateMessage(error) });
        }
        res.status(400).json({ message: error.message });
    }
};


export const updateStaff = async (req, res) => {
    try {
        const staff = await Staff.findById(req.params.id);
        if (!staff) return res.status(404).json({ message: 'Staff member not found' });

        if (req.body.emergencyContact !== undefined) {
            const emergencyContact = (req.body.emergencyContact || '').trim();
            if (emergencyContact && !isValidEmergencyContact(emergencyContact)) {
                return res.status(400).json({ message: 'Emergency contact must be a 10-digit number or a name with number, e.g. John Doe - 0712345678' });
            }
            req.body.emergencyContact = emergencyContact;
        }

        // Update fields
        const fields = [
            'name', 'email', 'phone', 'jobTitle', 'department', 'status', 'salary', 
            'hireDate', 'annualLeaveBalance', 'nic', 'address', 'dateOfBirth', 'emergencyContact', 'gender'
        ];
        fields.forEach(field => {
            if (req.body[field] !== undefined) {
                staff[field] = req.body[field];
            }
        });

        // Sync with User model
        if (staff.user) {
            const user = await User.findById(staff.user);
            if (user) {
                if (req.body.name) {
                    const nameParts = req.body.name.split(' ');
                    user.firstName = nameParts[0];
                    user.lastName = nameParts.slice(1).join(' ') || '';
                }
                if (req.body.email) user.email = req.body.email.toLowerCase();
                if (req.body.phone) user.phone = req.body.phone;
                if (req.body.password && req.body.password.trim() !== '') {
                    user.password = req.body.password;
                }
                if (req.body.status) {
                    user.status = req.body.status === 'Terminated' ? 'Inactive' : 'Active';
                }
                
                // Update role if job title or department changed
                if (req.body.jobTitle || req.body.department) {
                    const jobTitle = req.body.jobTitle || staff.jobTitle;
                    const department = req.body.department || staff.department;
                    const isReceptionist = jobTitle.toLowerCase().includes('receptionist') || 
                                          department === 'Front Desk';
                    user.role = isReceptionist ? 'receptionist' : 'staff';
                }

                await user.save();
            }
        }

        // Only update local staff password if provided (though login uses User model now)
        if (req.body.password && req.body.password.trim() !== '') {
            staff.password = req.body.password;
        }

        const updatedStaff = await staff.save();
        res.json(updatedStaff);
    } catch (error) {
        if (isDuplicateKeyError(error)) {
            return res.status(400).json({ message: getDuplicateMessage(error) });
        }
        res.status(400).json({ message: error.message });
    }
};


export const deleteStaff = async (req, res) => {
    try {
        const staff = await Staff.findById(req.params.id);
        if (!staff) return res.status(404).json({ message: 'Staff member not found' });

        // Delete associated user if exists
        if (staff.user) {
            await User.findByIdAndDelete(staff.user);
        }

        await Staff.findByIdAndDelete(req.params.id);
        res.json({ message: 'Staff member and associated account removed successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
