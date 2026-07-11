import Notification from '../models/Notification.js';

// Helper to create a notification (used by other controllers)
export const createNotification = async ({ type, title, message, link, metadata, targetRole = 'all' }) => {
    try {
        await Notification.create({ type, title, message, link, metadata, targetRole });
    } catch (e) {
        console.warn('Notification creation failed:', e.message);
    }
};

// GET /admin/notifications
export const getNotifications = async (req, res) => {
    try {
        const role = req.user?.role || 'admin';
        const filter = {
            $or: [
                { targetRole: { $exists: false } },
                { targetRole: 'all' },
                { targetRole: role }
            ]
        };

        const { limit = 30, unreadOnly } = req.query;

        if (unreadOnly === 'true') filter.read = false;

        const notifications = await Notification.find(filter)
            .sort({ createdAt: -1 })
            .limit(Number(limit));

        const unreadCount = await Notification.countDocuments({ ...filter, read: false });

        res.json({ notifications, unreadCount });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// PUT /admin/notifications/:id/read
export const markAsRead = async (req, res) => {
    try {
        const notification = await Notification.findByIdAndUpdate(
            req.params.id,
            { read: true },
            { new: true }
        );
        if (!notification) return res.status(404).json({ message: 'Notification not found' });
        res.json(notification);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// PUT /admin/notifications/read-all
export const markAllAsRead = async (req, res) => {
    try {
        await Notification.updateMany({ read: false }, { read: true });
        res.json({ message: 'All notifications marked as read' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// DELETE /admin/notifications/:id
export const deleteNotification = async (req, res) => {
    try {
        const notification = await Notification.findByIdAndDelete(req.params.id);
        if (!notification) return res.status(404).json({ message: 'Notification not found' });
        res.json({ message: 'Notification deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// DELETE /admin/notifications/delete-read
export const deleteAllRead = async (req, res) => {
    try {
        const result = await Notification.deleteMany({ read: true });
        res.json({ message: `Deleted ${result.deletedCount} read notification(s)` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

