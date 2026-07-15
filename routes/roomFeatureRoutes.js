import express from 'express';
import { getRoomFeatures, createRoomFeature, deleteRoomFeature } from '../controllers/roomFeatureController.js';
import { protect, admin } from '../middleware/auth.js';

const router = express.Router();

// Public/Staff can view
router.get('/', getRoomFeatures);

// Admin can manage
router.post('/', protect, admin, createRoomFeature);
router.delete('/:id', protect, admin, deleteRoomFeature);

export default router;
