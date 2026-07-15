import mongoose from 'mongoose';

const gallerySchema = new mongoose.Schema({
    url: {
        type: String,
        required: true,
    },
    title: {
        type: String,
        required: true,
        trim: true,
    },
    category: {
        type: String,
        required: true,
        enum: ['Rooms', 'Events', 'Resort', 'Dining'],
        default: 'Resort',
    },
}, {
    timestamps: true,
});

const Gallery = mongoose.model('Gallery', gallerySchema);

export default Gallery;
