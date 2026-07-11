import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true,
        enum: ['NEW_BOOKING', 'BOOKING_CANCELLED', 'BOOKING_COMPLETED', 'NEW_USER', 'ROOM_ISSUE', 'SYSTEM']
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    read: {
        type: Boolean,
        default: false
    },
    link: {
        type: String,
        default: ''
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    targetRole: {
        type: String,
        enum: ['all', 'admin', 'receptionist'],
        default: 'all'
    }
}, { timestamps: true });

// Auto-delete notifications older than 30 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
