import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema({
    firstName:{
        type: String,
        required: true,
        trim: true,
    },
    lastName:{
        type: String,
        required: true,
        trim: true,
    },
    email:{
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
    },
    phone:{
        type: String,
        trim: true,
        default: 'Not Provided',
    },
    password:{
        type: String,
        minlength: 6,
        // Make password optional for Google sign-in users
        required: function() { return !this.googleId; }
    },
    googleId: {
        type: String,
        sparse: true, 
        unique: true,
    },
    photoURL: {
        type: String,
        default: '',
    },
    role:{
        type: String,
        enum: ['guest', 'admin', 'receptionist'],
        default: 'guest',
    },
    status: {
        type: String,
        enum: ['Active', 'Inactive', 'Suspended'],
        default: 'Active',
    },
    resetOtp: {
        type: String,
    },
    resetOtpExpires: {
        type: Date,
    },
}, {
    timestamps: true
})

userSchema.pre('save', async function(next) {
    if(!this.isModified('password') || !this.password) {
        return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
})
userSchema.methods.matchPassword = async function(enteredPassword) {
    if (!this.password) return false;
    return await bcrypt.compare(enteredPassword, this.password);
}
const User = mongoose.model('User', userSchema);

export default User;
