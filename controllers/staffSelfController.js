import Employee from '../models/Employee.js';
import Attendance from '../models/Attendance.js';
import User from '../models/User.js';
import { generateToken } from '../utils/otpToken.js';

// Helper: get start of day
const startOfDay = (date = new Date()) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
};

// GET /api/staff/my-qr-token — returns a fresh 90-second OTP token for the logged-in employee
export const getMyQRToken = async (req, res) => {
    try {
        const employee = await Employee.findOne({ user: req.user._id });
        if (!employee) return res.status(404).json({ message: 'Employee profile not found' });
        if (employee.status !== 'Active') return res.status(403).json({ message: 'Your account is not active' });

        const token = generateToken(employee.employeeId);
        const expiresInSeconds = 90 - (Math.floor(Date.now() / 1000) % 90);

        res.json({
            token,
            employeeId: employee.employeeId,
            name: employee.name,
            department: employee.department,
            jobTitle: employee.jobTitle,
            expiresInSeconds: 90,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// GET /api/staff/me/profile
export const getMyProfile = async (req, res) => {
    try {
        const staff = await Employee.findOne({ user: req.user._id }).populate('user', 'firstName lastName email phone photoURL role');
        if (!staff) return res.status(404).json({ message: 'Staff profile not found' });
        res.json(staff);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// PUT /api/staff/me/profile
export const updateMyProfile = async (req, res) => {
    try {
        const employee = await Employee.findOne({ user: req.user._id });
        if (!employee) return res.status(404).json({ message: 'Employee profile not found' });

        const user = await User.findById(req.user._id);

        // Update User fields
        if (req.body.firstName) user.firstName = req.body.firstName;
        if (req.body.lastName) user.lastName = req.body.lastName;
        if (req.body.phone) user.phone = req.body.phone;
        if (req.body.photoURL) user.photoURL = req.body.photoURL;
        if (req.body.password && req.body.password.trim() !== '') {
            user.password = req.body.password;
        }
        await user.save();

        // Update Employee fields
        employee.name = `${user.firstName} ${user.lastName}`;
        employee.phone = user.phone;
        if (req.body.password && req.body.password.trim() !== '') {
            employee.password = req.body.password;
        }
        await employee.save();

        res.json({ message: 'Profile updated successfully', employee });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// GET /api/staff/me/attendance
export const getMyAttendance = async (req, res) => {
    try {
        const employee = await Employee.findOne({ user: req.user._id });
        if (!employee) return res.status(404).json({ message: 'Employee profile not found' });

        const { month, year } = req.query;
        const now = new Date();
        const targetYear = parseInt(year) || now.getFullYear();
        const targetMonth = parseInt(month) || now.getMonth();

        const firstDay = new Date(targetYear, targetMonth, 1);
        const lastDay = new Date(targetYear, targetMonth + 1, 0);

        const records = await Attendance.find({
            employee: employee._id,
            date: { $gte: firstDay, $lte: lastDay }
        }).sort({ date: -1 });

        const summary = {
            present: records.filter(r => r.status === 'Present').length,
            late: records.filter(r => r.status === 'Late').length,
            halfDay: records.filter(r => r.status === 'Half-Day').length,
            absent: records.filter(r => r.status === 'Absent').length,
            totalHours: records.reduce((sum, r) => sum + (r.workHours || 0), 0).toFixed(2)
        };

        res.json({ records, summary });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// GET /api/staff/me/payroll/last
export const getMyLastPayroll = async (req, res) => {
    try {
        const employee = await Employee.findOne({ user: req.user._id });
        if (!employee) return res.status(404).json({ message: 'Employee profile not found' });

        const now = new Date();
        // Go back to previous month
        let targetMonth = now.getMonth() - 1;
        let targetYear = now.getFullYear();
        if (targetMonth < 0) {
            targetMonth = 11;
            targetYear--;
        }

        const firstDay = new Date(targetYear, targetMonth, 1);
        const lastDay = new Date(targetYear, targetMonth + 1, 0);

        const empRecords = await Attendance.find({
            employee: employee._id,
            date: { $gte: firstDay, $lte: lastDay }
        });

        const presentDays = empRecords.filter(r => r.status === 'Present' || r.status === 'Late').length;
        const halfDays = empRecords.filter(r => r.status === 'Half-Day').length;
        const totalWorkHours = empRecords.reduce((sum, r) => sum + (r.workHours || 0), 0);

        // Calculate working days in the month (Mon-Sat)
        let workingDays = 0;
        for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
            const day = d.getDay();
            if (day !== 0) workingDays++; // Exclude Sundays
        }

        const effectiveDays = presentDays + (halfDays * 0.5);
        const dailyRate = employee.salary / workingDays;
        const basePay = parseFloat((dailyRate * effectiveDays).toFixed(2));
        const latePenalty = empRecords.filter(r => r.status === 'Late').length;
        const deductions = parseFloat((latePenalty * (dailyRate * 0.05)).toFixed(2)); 
        const netPay = parseFloat((basePay - deductions).toFixed(2));

        res.json({
            month: targetMonth,
            year: targetYear,
            salary: employee.salary,
            presentDays,
            halfDays,
            lateDays: latePenalty,
            workingDays,
            totalWorkHours: parseFloat(totalWorkHours.toFixed(2)),
            basePay,
            deductions,
            netPay,
            status: effectiveDays === 0 ? 'No Attendance' : 'Calculated',
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
