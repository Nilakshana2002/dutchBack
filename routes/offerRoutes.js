import express from 'express';
const router = express.Router();
import {
    getOffers,
    getActiveOffers,
    createOffer,
    updateOffer,
    deleteOffer
} from '../controllers/offerController.js';

// Define routes
router.route('/')
    .get(getOffers)
    .post(createOffer); // In a real app, protect this route with admin middleware

router.route('/active')
    .get(getActiveOffers);

router.route('/:id')
    .put(updateOffer)    // In a real app, protect this route
    .delete(deleteOffer); // In a real app, protect this route

export default router;
