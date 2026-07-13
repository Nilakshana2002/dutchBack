import RoomFeature from '../models/RoomFeature.js';

// Get all room features
export const getRoomFeatures = async (req, res) => {
    try {
        const features = await RoomFeature.find({ status: 'active' });
        res.json(features);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Create a new room feature
export const createRoomFeature = async (req, res) => {
    try {
        const { name, icon } = req.body;
        
        // Check if feature already exists
        const existing = await RoomFeature.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
        if (existing) {
            return res.status(400).json({ message: 'Feature already exists' });
        }

        const feature = await RoomFeature.create({ name, icon });
        res.status(201).json(feature);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Admin: Delete/Inactivate feature (optional but good to have)
export const deleteRoomFeature = async (req, res) => {
    try {
        const feature = await RoomFeature.findByIdAndDelete(req.params.id);
        if (!feature) return res.status(404).json({ message: 'Feature not found' });
        res.json({ message: 'Feature deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
