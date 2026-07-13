import mongoose from 'mongoose';

const roomFeatureSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true,
    },
    icon: {
        type: String,
        default: 'CheckCircle',
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active',
    }
}, {
    timestamps: true,
});

const RoomFeature = mongoose.model('RoomFeature', roomFeatureSchema);

export default RoomFeature;
