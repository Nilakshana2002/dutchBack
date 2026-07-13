import User from '../models/User.js';


export const getUsers = async (req, res) => {
    try {
        const { page = 1, limit = 20, search, role } = req.query;

        const query = {};
        if (search) {
            query.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } },
            ];
        }
        if (role && role !== 'all') query.role = role;

        const total = await User.countDocuments(query);
        const users = await User.find(query)
            .select('-password')
            .sort({ createdAt: -1 })
            .skip((page - 1) * parseInt(limit))
            .limit(parseInt(limit));

        res.json({
            users,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit)),
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// GET user by ID
export const getUserById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// POST create user (admin)
export const createUser = async (req, res) => {
    try {
        const { firstName, lastName, email, phone, password, role, status } = req.body;

        if (!firstName || !email || !password) {
            return res.status(400).json({ message: 'First name, email, and password are required' });
        }

        const exists = await User.findOne({ email: email.toLowerCase() });
        if (exists) return res.status(400).json({ message: 'User with this email already exists' });

        const user = await User.create({
            firstName,
            lastName: lastName || '',
            email: email.toLowerCase(),
            phone,
            password,
            role: role || 'guest',
            status: status || 'Active',
        });

        const { password: _, ...userObj } = user.toObject();
        res.status(201).json(userObj);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};



export const updateUser = async (req, res) => {
    try {
        const { password, firstName, lastName, email, phone, role, status } = req.body;

        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (firstName) user.firstName = firstName;
        if (lastName) user.lastName = lastName;
        if (email) user.email = email.toLowerCase();
        if (phone) user.phone = phone;
        if (role) user.role = role;
        if (status) user.status = status;
        if (password) user.password = password;

        const updatedUser = await user.save();
        const { password: _, ...userObj } = updatedUser.toObject();
        res.json(userObj);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// DELETE user
export const deleteUser = async (req, res) => {
    try {
        if (req.params.id === req.user._id.toString()) {
            return res.status(400).json({ message: 'Cannot delete your own account' });
        }

        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
