import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Room from './models/Room.js';

dotenv.config();

const updatePrices = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const result = await Room.updateMany(
            { type: 'deluxe' },
            { $set: { price: 10000, package: 'full-board' } } // Assuming full-board is legacy default, or could be 'room-only'
        );

        console.log(`Successfully updated ${result.modifiedCount} deluxe rooms to base price 10000.`);
        
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    } catch (error) {
        console.error('Error updating prices:', error);
        process.exit(1);
    }
};

updatePrices();
