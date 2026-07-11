import express from 'express';
import { getRoomsByCategory, checkRoomAvailability, getAllRoomsPublic } from '../controllers/roomController.js';

const router = express.Router();

router.get('/', getAllRoomsPublic);
router.get('/category/:category', getRoomsByCategory);


router.post('/check-availability', checkRoomAvailability);

export default router;
