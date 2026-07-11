import express from 'express';
import { protect } from '../middleware/auth.js';
import { 
    getMyProfile, 
    updateMyProfile, 
    getMyAttendance, 
    getMyLastPayroll,
    getMyQRToken,
} from '../controllers/staffSelfController.js';

const router = express.Router();

// Middleware to ensure the user is at least a staff member
const staffOnly = (req, res, next) => {
    if (req.user && (req.user.role === 'staff' || req.user.role === 'admin' || req.user.role === 'receptionist')) {
        next();
    } else {
        res.status(403).json({ message: 'Access denied. Staff only.' });
    }
};

router.use(protect, staffOnly);

router.get('/profile', getMyProfile);
router.put('/profile', updateMyProfile);
router.get('/attendance', getMyAttendance);
router.get('/payroll/last', getMyLastPayroll);
router.get('/my-qr-token', getMyQRToken);

export default router;
