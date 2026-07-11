import mongoose from 'mongoose';

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        if (error.message.includes('ECONNREFUSED')) {
            console.error('CRITICAL: Check your IP Whitelist in MongoDB Atlas.');
        }
        process.exit(1);
    }
};

export default connectDB;
