import express from 'express';
import { 
    createBooking, 
    getBookings, 
    getBookingById, 
    updateBookingStatus,
    getDashboardStats,
    getMonthlyRevenue,
    confirmBookingPayment,
    getDebugDates
} from '../controllers/bookingController.js';

const router = express.Router();

router.post('/', createBooking);
router.post('/:id/confirm-payment', confirmBookingPayment);
router.get('/debug-dates', getDebugDates);
router.get('/', getBookings);
router.get('/stats', getDashboardStats);
router.get('/revenue', getMonthlyRevenue);
router.get('/:id', getBookingById);
router.patch('/:id/status', updateBookingStatus);

export default router;
