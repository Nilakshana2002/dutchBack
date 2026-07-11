import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema({
    employee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true,
    },
    employeeId: {
        type: String,
        required: true,
    },
    date: {
        type: Date,
        required: true,
    },
    checkIn: {
        type: Date,
    },
    checkOut: {
        type: Date,
    },
    status: {
        type: String,
        enum: ['Present', 'Late', 'Absent', 'Half-Day'],
        default: 'Present',
    },
    workHours: {
        type: Number,
        default: 0,
    },
}, {
    timestamps: true,
});

// Prevent duplicate attendance for the same employee on the same date
attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });

const Attendance = mongoose.model('Attendance', attendanceSchema);

export default Attendance;
