import express from 'express';
import { getFoods, createFood, updateFood, deleteFood } from '../controllers/foodController.js';
import { protect, admin } from '../middleware/auth.js';

const router = express.Router();

router.route('/')
    .get(getFoods)
    .post(protect, admin, createFood);

router.route('/:id')
    .put(protect, admin, updateFood)
    .delete(protect, admin, deleteFood);

export default router;
