import express from 'express';
import { getAiExecutiveSummary } from '../controllers/aiController.js';
import { protect, admin } from '../middleware/auth.js';

const router = express.Router();

// Apply protection - only admins should see the executive summary
router.get('/summary', protect, admin, getAiExecutiveSummary);

export default router;
