import mongoose from 'mongoose';

const connectDB = async () => {
    // Check if we already have a connection
    if (mongoose.connection.readyState >= 1) {
        return mongoose.connection;
    }

    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        return conn;
    } catch (error) {
        console.error(`Error: ${error.message}`);
        if (error.message.includes('ECONNREFUSED')) {
            console.error('CRITICAL: Check your IP Whitelist in MongoDB Atlas.');
        }
        // Do not crash the process in production (Vercel)
        if (process.env.NODE_ENV !== 'production') {
            process.exit(1);
        }
        throw error;
    }
};

export default connectDB;
