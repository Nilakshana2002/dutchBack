import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import sendEmail from '../utils/sendEmail.js';
import crypto from 'crypto';

const generateToken = (id, accountType = 'local') => {
    return jwt.sign({ id, accountType }, process.env.JWT_SECRET, {
        expiresIn: '30d'
    });
};

const isDuplicateKeyError = (error) => error?.code === 11000;

const logServerError = (scope, error) => {
    console.error(`[${scope}]`, error?.message || error);
};

const parseName = (displayName = '') => {
    const parts = displayName.trim().split(' ').filter(Boolean);
    if (parts.length === 0) {
        return { firstName: 'Guest', lastName: 'User' };
    }
    if (parts.length === 1) {
        return { firstName: parts[0], lastName: 'User' };
    }
    return {
        firstName: parts[0],
        lastName: parts.slice(1).join(' '),
    };
};

const verifyGoogleIdToken = async (idToken) => {
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (!response.ok) {
        throw new Error('Invalid Google token');
    }

    const tokenData = await response.json();
    if (!(tokenData.email_verified === 'true' || tokenData.email_verified === true)) {
        throw new Error('Google account email is not verified');
    }

    
    if (process.env.GOOGLE_CLIENT_ID && tokenData.aud !== process.env.GOOGLE_CLIENT_ID) {
        throw new Error('Google token audience mismatch');
    }

    return tokenData;
};


export const registerUser = async (req, res) => {
    try {
        const { firstName, lastName, email, phone, password } = req.body;

        const userExists = await User.findOne({ email });

        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const user = await User.create({
            firstName,
            lastName,
            email,
            phone,
            password
        });

        if (user) {
            res.status(201).json({
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                phone: user.phone,
                role: user.role,
                accountType: 'local',
                token: generateToken(user._id, 'local')
            });
        } else {
            res.status(400).json({ message: 'Invalid user data' });
        }
    } catch (error) {
        logServerError('registerUser', error);
        if (isDuplicateKeyError(error)) {
            return res.status(400).json({ message: 'User already exists' });
        }
        res.status(500).json({ message: 'Registration failed. Please try again.' });
    }
};


export const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });

        if (user && (await user.matchPassword(password))) {
            res.json({
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                phone: user.phone,
                role: user.role,
                accountType: 'local',
                token: generateToken(user._id, 'local')
            });
        } else {
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        logServerError('loginUser', error);
        res.status(500).json({ message: 'Login failed. Please try again.' });
    }
};


export const googleAuth = async (req, res) => {
    try {
        const { idToken, googleId: rawGoogleId, email: rawEmail, displayName, photoURL } = req.body;

        if (!idToken) {
            return res.status(400).json({ message: 'Google idToken is required' });
        }

        const tokenData = await verifyGoogleIdToken(idToken);
        const googleId = tokenData.sub || rawGoogleId;
        const email = (tokenData.email || rawEmail || '').toLowerCase();

        if (!googleId || !email) {
            return res.status(400).json({ message: 'Invalid Google account payload' });
        }

        let googleUser = await User.findOne({ $or: [{ googleId }, { email }] });
        if (!googleUser) {
            const parsed = parseName(tokenData.name || displayName || 'Guest User');
            googleUser = await User.create({
                googleId,
                firstName: parsed.firstName,
                lastName: parsed.lastName,
                email,
                photoURL: tokenData.picture || photoURL || '',
            });
        } else {
            if (googleUser.googleId !== googleId) {
                googleUser.googleId = googleId;
            }
            if (!googleUser.photoURL && (tokenData.picture || photoURL)) {
                googleUser.photoURL = tokenData.picture || photoURL;
            }
            await googleUser.save();
        }

        res.status(200).json({
            _id: googleUser._id,
            firstName: googleUser.firstName,
            lastName: googleUser.lastName,
            email: googleUser.email,
            phone: googleUser.phone,
            role: googleUser.role,
            photoURL: googleUser.photoURL,
            accountType: 'google',
            token: generateToken(googleUser._id, 'google'),
        });
    } catch (error) {
        logServerError('googleAuth', error);
        if (
            error?.message === 'Invalid Google token' ||
            error?.message === 'Google account email is not verified' ||
            error?.message === 'Google token audience mismatch'
        ) {
            return res.status(401).json({ message: error.message });
        }
        if (isDuplicateKeyError(error)) {
            return res.status(409).json({ message: 'Google account already exists. Please sign in again.' });
        }
        res.status(500).json({ message: 'Google authentication failed. Please try again.' });
    }
};


export const getUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (user) {
            res.json({
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                phone: user.phone,
                role: user.role,
                photoURL: user.photoURL || '',
                accountType: req.user?.accountType || 'local',
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        logServerError('getUserProfile', error);
        res.status(500).json({ message: 'Failed to load profile.' });
    }
};


export const updateUserProfile = async (req, res) => {
    try {
        const isGoogleUser = req.user?.googleId || req.user?.accountType === 'google';
        const user = await User.findById(req.user._id);

        if (user) {
            user.firstName = req.body.firstName?.trim() || user.firstName;
            user.lastName = req.body.lastName?.trim() || user.lastName;
            user.phone = req.body.phone?.trim() || user.phone;

            if (!isGoogleUser && req.body.password) {
                user.password = req.body.password;
            }

            const updatedUser = await user.save();

            res.json({
                _id: updatedUser._id,
                firstName: updatedUser.firstName,
                lastName: updatedUser.lastName,
                email: updatedUser.email,
                phone: updatedUser.phone,
                role: updatedUser.role,
                photoURL: updatedUser.photoURL || '',
                accountType: isGoogleUser ? 'google' : 'local',
                token: generateToken(updatedUser._id, isGoogleUser ? 'google' : 'local')
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        logServerError('updateUserProfile', error);
        res.status(500).json({ message: 'Failed to update profile.' });
    }
};

// @desc    Forgot Password - Send OTP
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'This email is not registered. Please sign up first.' });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Hash OTP and set expiry (10 minutes)
        user.resetOtp = crypto.createHash('sha256').update(otp).digest('hex');
        user.resetOtpExpires = Date.now() + 10 * 60 * 1000;

        await user.save();

        const message = `Your password reset OTP is: ${otp}. It is valid for 10 minutes.`;

        try {
            await sendEmail({
                email: user.email,
                subject: 'Password Reset OTP - Dutch Point Resort',
                message,
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                        <h2 style="color: #0f172a;">Password Reset</h2>
                        <p>Hi ${user.firstName},</p>
                        <p>You requested to reset your password. Use the OTP code below to proceed:</p>
                        <div style="background: #f1f5f9; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
                            <h1 style="letter-spacing: 10px; color: #0d9488; margin: 0;">${otp}</h1>
                        </div>
                        <p>This code is valid for <strong>10 minutes</strong>. If you did not request this, please ignore this email.</p>
                        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                        <p style="font-size: 12px; color: #64748b;">Dutch Point Resort Negombo</p>
                    </div>
                `,
            });

            res.status(200).json({ message: 'OTP sent to email' });
        } catch (error) {
            user.resetOtp = undefined;
            user.resetOtpExpires = undefined;
            await user.save();
            logServerError('forgotPassword-email', error);
            return res.status(500).json({ message: 'Email could not be sent' });
        }
    } catch (error) {
        logServerError('forgotPassword', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
// @access  Public
export const verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        
        if (!email || !otp) {
            return res.status(400).json({ message: 'Email and OTP are required' });
        }

        const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

        const user = await User.findOne({
            email,
            resetOtp: hashedOtp,
            resetOtpExpires: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        res.status(200).json({ message: 'OTP verified successfully' });
    } catch (error) {
        logServerError('verifyOTP', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Reset Password using OTP
// @route   POST /api/auth/reset-password
// @access  Public
export const resetPassword = async (req, res) => {
    try {
        const { email, otp, password } = req.body;

        const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

        const user = await User.findOne({
            email,
            resetOtp: hashedOtp,
            resetOtpExpires: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        // Set new password
        user.password = password;
        user.resetOtp = undefined;
        user.resetOtpExpires = undefined;

        await user.save();

        res.status(200).json({
            message: 'Password reset successful',
            token: generateToken(user._id, user.googleId ? 'google' : 'local')
        });
    } catch (error) {
        logServerError('resetPassword', error);
        res.status(500).json({ message: 'Server error' });
    }
};