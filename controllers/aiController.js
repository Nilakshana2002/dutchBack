import { GoogleGenerativeAI } from '@google/generative-ai';
import Booking from '../models/Booking.js';
import Room from '../models/Room.js';
import User from '../models/User.js';


export const getAiExecutiveSummary = async (req, res) => {
    try {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY is missing in backend environment variables.');
        }
        
        console.log('AI Controller: Using API Key with length:', process.env.GEMINI_API_KEY.length);
        
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        
        // 1. Gather all relevant data for the summary
        const [
            totalBookings,
            pendingBookings,
            confirmedBookings,
            totalUsers,
            availableRooms,
            revenueResult,
        ] = await Promise.all([
            Booking.countDocuments(),
            Booking.countDocuments({ status: 'pending' }),
            Booking.countDocuments({ status: 'reserved' }),
            User.countDocuments({ role: 'guest' }),
            Room.countDocuments({ status: 'available' }),
            Booking.aggregate([
                { $match: { status: { $in: ['reserved', 'checked_in', 'checked_out'] } } },
                { $group: { _id: null, total: { $sum: '$total' } } },
            ]),
        ]);

        const totalRevenue = revenueResult[0]?.total || 0;

        // 2. Prepare the prompt for Gemini
        const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

        const prompt = `
            You are a professional AI Companion for hotel management. 
            Analyze the following hotel performance data and provide a "Method A" Executive Summary with a "Wow Factor".
            
            DATA:
            - Total Bookings: ${totalBookings}
            - Pending Bookings: ${pendingBookings}
            - Confirmed Bookings: ${confirmedBookings}
            - Total Customers: ${totalUsers}
            - Available Rooms: ${availableRooms}
            - Total Revenue (Rooms): Rs. ${totalRevenue.toLocaleString()}

            FORMAT REQUIREMENTS:
            1. Return ONLY a JSON object.
            2. The JSON should have these keys:
               - "mood": (A string like "growth", "caution", or "steady" based on data)
               - "score": (A number 0-100 representing overall hotel health)
               - "pillars": {
                   "financial": (Detailed multi-paragraph analysis of revenue, profit potential, and financial health in Sinhala. Include specific numbers and comparisons),
                   "operational": (Detailed multi-paragraph analysis of room availability vs bookings, operational bottlenecks, and efficiency in Sinhala),
                   "guestExperience": (Detailed multi-paragraph analysis of order trends and guest engagement in Sinhala)
                 }
               - "recommendations": (An array of 3 strings providing short, insightful advice for the admin in Sinhala)
               - "thoughtStream": (An array of 4 short strings representing your "thought process" in English)
            
            LANGUAGE & TONE:
            - The "pillars" and "recommendations" MUST be in Sinhala (සිංහල).
            - Output should be detailed and professional. Instead of one-line summaries, provide deep insights using the provided data.
            - Use a professional, executive tone.
            - Keep JSON keys in English.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text();
        
        // Robust JSON Extraction
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            text = jsonMatch[0];
        }
        
        try {
            const summary = JSON.parse(text);
            res.json(summary);
        } catch (parseError) {
            console.error('Gemini returned invalid JSON:', text);
            throw new Error('AI returned an invalid data format. Please try again.');
        }
    } catch (error) {
        console.error('AI Summary Error Detail:', error);
        res.status(500).json({ 
            message: `AI Analysis Error: ${error.message}`
        });
    }
};
