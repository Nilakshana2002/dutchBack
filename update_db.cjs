const mongoose = require('mongoose');
require('dotenv').config();

async function updateDb() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Mongoose Model (simplified schema is fine for update)
    const Room = mongoose.models.Room || mongoose.model('Room', new mongoose.Schema({ type: String }, { strict: false }));

    // 1. Update deluxe -> standard
    const res1 = await Room.updateMany({ type: 'deluxe' }, { $set: { type: 'standard' } });
    console.log(`Updated deluxe -> standard: ${res1.modifiedCount} rooms modified.`);

    // 2. Update semiluxury -> deluxe
    const res2 = await Room.updateMany({ type: 'semiluxury' }, { $set: { type: 'deluxe' } });
    console.log(`Updated semiluxury -> deluxe: ${res2.modifiedCount} rooms modified.`);

    console.log('Database migration complete.');
    process.exit(0);
  } catch (err) {
    console.error('Error during migration:', err);
    process.exit(1);
  }
}

updateDb();
