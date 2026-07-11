import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const staffSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, trim: true, lowercase: true },
        phone: { type: String, trim: true },
        jobTitle: { type: String, required: true, trim: true },
        password: { type: String, required: true },
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        department: {
            type: String,
            required: true,
            enum: ['Operations', 'Kitchen', 'Front Desk', 'Housekeeping', 'Dining', 'Security', 'Maintenance', 'Finance', 'HR'],
        },
        status: {
            type: String,
            enum: ['Active', 'On Leave', 'Terminated'],
            default: 'Active',
        },
        salary: { type: Number, default: 0, min: 0 },
        hireDate: { type: Date, default: Date.now },
        annualLeaveBalance: { type: Number, default: 14 }, // Default annual leaves
        nic: { type: String, unique: true, sparse: true },
        address: { type: String },
        dateOfBirth: { type: Date },
        emergencyContact: { type: String },
        gender: { type: String, enum: ['Male', 'Female', 'Other'] },
    },
    { timestamps: true }
);

// Match password for login
staffSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Encrypt password before saving
staffSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

const Staff = mongoose.model('Staff', staffSchema);
export default Staff;
