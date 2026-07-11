import express from 'express';
import { protect, admin, receptionistOrAdmin } from '../middleware/auth.js';

    // User management
import { getUsers, getUserById, createUser, updateUser, deleteUser } from '../controllers/adminController.js';

// Room management
import { getRooms, createRoom, getRoomById, updateRoom, deleteRoom, updateRoomStatusByNumber } from '../controllers/roomController.js';

// Booking management
import {
    getBookings,
    getBookingById,
    updateBookingStatus,
    getDashboardStats,
    getMonthlyRevenue,
} from '../controllers/bookingController.js';

// Staff management
import { getStaff, getStaffById, createStaff, updateStaff, deleteStaff } from '../controllers/staffController.js';


// Audit & Notifications
import { getNotifications, markAsRead, markAllAsRead, deleteNotification, deleteAllRead } from '../controllers/notificationController.js';


// Contact management
import { getContacts, updateContactStatus, deleteContact } from '../controllers/contactController.js';



const router = express.Router();


router.use(protect);

// Role restrictions by route prefix
router.use('/users', admin);
router.use('/staff', admin);

router.use('/contacts', admin);


router.use('/rooms', receptionistOrAdmin);
router.use('/bookings', receptionistOrAdmin);
router.use('/notifications', receptionistOrAdmin);
router.use('/stats', receptionistOrAdmin);
router.use('/revenue', receptionistOrAdmin);

//Dashboard 
router.get('/stats', getDashboardStats);
router.get('/revenue/monthly', getMonthlyRevenue);

//Users 
router.get('/users', getUsers);
router.get('/users/:id', getUserById);
router.post('/users', createUser);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);

//Rooms
router.get('/rooms', getRooms);
router.post('/rooms', createRoom); // Added this line
router.get('/rooms/:id', getRoomById);
router.put('/rooms/:id', updateRoom);
router.put('/rooms/number/:roomNumber/status', updateRoomStatusByNumber);
router.delete('/rooms/:id', deleteRoom);

//Bookings
router.get('/bookings', getBookings);
router.get('/bookings/:id', getBookingById);
router.put('/bookings/:id/status', updateBookingStatus);

//Staff
router.get('/staff', getStaff);
router.get('/staff/:id', getStaffById);
router.post('/staff', createStaff);
router.put('/staff/:id', updateStaff);
router.delete('/staff/:id', deleteStaff);


// Audit & Notifications
router.get('/notifications', getNotifications);
router.put('/notifications/read-all', markAllAsRead);
router.delete('/notifications/delete-read', deleteAllRead);
router.put('/notifications/:id/read', markAsRead);
router.delete('/notifications/:id', deleteNotification);



//Contact/Feedback
router.get('/contacts', getContacts);
router.put('/contacts/:id/status', updateContactStatus);
router.delete('/contacts/:id', deleteContact);



export default router;
