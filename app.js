import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

import authRoutes from './routes/authRoutes.js';
import contactRoutes from './routes/contactRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import roomRoutes from './routes/roomRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import foodRoutes from './routes/foodRoutes.js';
// merged routes (both branches kept)
import offerRoutes from './routes/offerRoutes.js';
import roomFeatureRoutes from './routes/roomFeatureRoutes.js';
import mealPlanRoutes from './routes/mealPlanRoutes.js';
import galleryRoutes from './routes/galleryRoutes.js';

// upload controller (from anjana branch)
import { uploadImage, uploadMiddleware } from './controllers/uploadController.js';

import connectDB from './config/database.js';

dotenv.config();

const app = express();

// Database connection middleware (essential for serverless environment)
app.use(async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (error) {
        console.error('Database connection error in middleware:', error);
        res.status(500).json({ error: 'Database connection failed' });
    }
});

const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

app.use(express.json());

// routes
app.use('/api/auth', authRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/foods', foodRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/gallery', galleryRoutes);

// merged new modules
app.use('/api/offers', offerRoutes);
app.use('/api/room-features', roomFeatureRoutes);
app.use('/api/meal-plans', mealPlanRoutes);

// shared upload route
app.post('/api/upload/image', uploadMiddleware, uploadImage);

app.get('/api/health', (req, res) => {
    res.json({ message: 'API is running' });
});

export default app;