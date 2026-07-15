import dns from 'dns';
import dotenv from 'dotenv';

// 1. Load environment variables
dotenv.config();

// 2. Force Node.js to use Google DNS to bypass local connection issues (e.g. SRV resolution)
dns.setServers(['8.8.8.8', '8.8.4.4']);
if (typeof dns.setDefaultResultOrder === 'function') {
    dns.setDefaultResultOrder('ipv4first');
}

// 3. Import app and connectDB
import app from './app.js';
import connectDB from './config/database.js';


const PORT = process.env.PORT || 5000;

// 4. Connect to Database then start server
const startServer = async () => {
    try {
        await connectDB();
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        // process.exit(1); // Don't exit immediately so nodemon can watch for changes
    }
};

startServer();
// Trigger restart