import express from 'express';
import { getMealPlans, seedMealPlans } from '../controllers/mealPlanController.js';
import { protect, admin } from '../middleware/auth.js';

const router = express.Router();

router.get('/', getMealPlans);
router.post('/seed', protect, admin, seedMealPlans);

export default router;
