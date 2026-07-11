import Offer from '../models/Offer.js';

// @desc    Get all offers
// @route   GET /api/offers
// @access  Public
export const getOffers = async (req, res) => {
    try {
        const offers = await Offer.find({}).sort({ createdAt: -1 });
        res.json(offers);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching offers', error: error.message });
    }
};

// @desc    Get active offers
// @route   GET /api/offers/active
// @access  Public
export const getActiveOffers = async (req, res) => {
    try {
        const currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0); // Start of today
        
        const activeOffers = await Offer.find({
            isActive: true,
            endDate: { $gte: currentDate } // Only filter out fully expired offers; allow future offers
        }).sort({ discountPercentage: -1 }); // Highest discount first
        res.json(activeOffers);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching active offers', error: error.message });
    }
};

// @desc    Create an offer
// @route   POST /api/offers
// @access  Private/Admin
export const createOffer = async (req, res) => {
    try {
        const { title, description, discountPercentage, startDate, endDate, applicableRoomTypes, isActive } = req.body;

        const offer = new Offer({
            title,
            description,
            discountPercentage,
            startDate,
            endDate,
            applicableRoomTypes,
            isActive
        });

        const createdOffer = await offer.save();
        res.status(201).json(createdOffer);
    } catch (error) {
        res.status(400).json({ message: 'Error creating offer', error: error.message });
    }
};

// @desc    Update an offer
// @route   PUT /api/offers/:id
// @access  Private/Admin
export const updateOffer = async (req, res) => {
    try {
        const { title, description, discountPercentage, startDate, endDate, applicableRoomTypes, isActive } = req.body;

        const offer = await Offer.findById(req.params.id);

        if (offer) {
            offer.title = title || offer.title;
            offer.description = description !== undefined ? description : offer.description;
            offer.discountPercentage = discountPercentage !== undefined ? discountPercentage : offer.discountPercentage;
            offer.startDate = startDate || offer.startDate;
            offer.endDate = endDate || offer.endDate;
            offer.applicableRoomTypes = applicableRoomTypes || offer.applicableRoomTypes;
            offer.isActive = isActive !== undefined ? isActive : offer.isActive;

            const updatedOffer = await offer.save();
            res.json(updatedOffer);
        } else {
            res.status(404).json({ message: 'Offer not found' });
        }
    } catch (error) {
        res.status(400).json({ message: 'Error updating offer', error: error.message });
    }
};

// @desc    Delete an offer
// @route   DELETE /api/offers/:id
// @access  Private/Admin
export const deleteOffer = async (req, res) => {
    try {
        const offer = await Offer.findById(req.params.id);

        if (offer) {
            await offer.deleteOne();
            res.json({ message: 'Offer removed' });
        } else {
            res.status(404).json({ message: 'Offer not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error deleting offer', error: error.message });
    }
};
