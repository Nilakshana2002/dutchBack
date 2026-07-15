import Gallery from '../models/Gallery.js';

// @desc    Get all gallery items
// @route   GET /api/gallery
// @access  Public
export const getGalleryItems = async (req, res) => {
    try {
        const items = await Gallery.find().sort({ createdAt: -1 });
        res.json(items);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create a gallery item
// @route   POST /api/gallery
// @access  Private/Admin
export const createGalleryItem = async (req, res) => {
    try {
        const { url, title, category } = req.body;

        if (!url || !title || !category) {
            return res.status(400).json({ message: 'Please provide url, title and category' });
        }

        const item = await Gallery.create({
            url,
            title,
            category
        });

        res.status(201).json(item);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete a gallery item
// @route   DELETE /api/gallery/:id
// @access  Private/Admin
export const deleteGalleryItem = async (req, res) => {
    try {
        const item = await Gallery.findById(req.params.id);

        if (!item) {
            return res.status(404).json({ message: 'Gallery item not found' });
        }

        await item.deleteOne();
        res.json({ message: 'Gallery item removed successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
