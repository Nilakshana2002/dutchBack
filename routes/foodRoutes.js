import express from 'express';
import { getFoods, createFood, updateFood, deleteFood } from '../controllers/foodController.js';
import { protect, receptionistOrAdmin } from '../middleware/auth.js';

const router = express.Router();

router.route('/')
    .get(getFoods)
    .post(protect, receptionistOrAdmin, createFood);

router.route('/:id')
    .put(protect, receptionistOrAdmin, updateFood)
    .delete(protect, receptionistOrAdmin, deleteFood);

export default router;
