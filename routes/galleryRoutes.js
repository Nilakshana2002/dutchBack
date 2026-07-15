import express from 'express';
import { getGalleryItems, createGalleryItem, deleteGalleryItem } from '../controllers/galleryController.js';
import { protect, admin } from '../middleware/auth.js';

const router = express.Router();

router.get('/', getGalleryItems);
router.post('/', protect, admin, createGalleryItem);
router.delete('/:id', protect, admin, deleteGalleryItem);

export default router;
