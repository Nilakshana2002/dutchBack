import Booking from '../models/Booking.js';
import Room from '../models/Room.js';
import User from '../models/User.js';
import Offer from '../models/Offer.js';

import crypto from 'crypto';
import { createNotification } from './notificationController.js';
import sendEmail from '../utils/sendEmail.js';
import { getStartOfTodaySL, getEndOfTodaySL } from '../utils/timezone.js';

// --- PayHere Hash Helper ---
const generatePayHereHash = (merchantId, orderId, amount, currency, merchantSecret) => {
    const hashedSecret = crypto.createHash('md5').update(merchantSecret).digest('hex').toUpperCase();
    const amountFormatted = Number(amount).toFixed(2);
    const mainString = merchantId + orderId + amountFormatted + currency + hashedSecret;
    return crypto.createHash('md5').update(mainString).digest('hex').toUpperCase();
};

// --- Helpers ---
const detectCardBrand = (num) => {
    const n = num.replace(/\s/g, '');
    if (/^4/.test(n)) return 'Visa';
    if (/^5[1-5]/.test(n) || /^2[2-7]/.test(n)) return 'Mastercard';
    if (/^3[47]/.test(n)) return 'Amex';
    if (/^6(?:011|5)/.test(n)) return 'Discover';
    return 'Unknown';
};

export const createBooking = async (req, res) => {
    try {
        const {
            userId,
            roomId,
            checkIn,
            checkOut,
            guests,
            guestInfo,
            cardDetails,
            paymentMethod = 'card'
        } = req.body;

        // 1. Validate room exists
        const room = await Room.findById(roomId);
        if (!room) {
            return res.status(404).json({ message: 'Room not found' });
        }

        // 2. Prepare dates
        const startDate = new Date(checkIn);
        const endDate = new Date(checkOut);

        // Find all rooms in this category that represent this same physical room
        const relatedRooms = await Room.find({ roomNumber: room.roomNumber });
        const relatedIds = relatedRooms.map(r => r._id);

        // 3. Check for overlapping bookings
        const overlappingBooking = await Booking.findOne({
            room: { $in: relatedIds },
            status: { $in: ['reserved', 'checked_in'] },
            $or: [
                { checkIn: { $lte: endDate }, checkOut: { $gte: startDate } }
            ]
        });

        if (overlappingBooking) {
            return res.status(400).json({ message: 'Room is already booked for these dates' });
        }

        // --- Card Validation (Only for card payments) ---
        let paymentDetails = {};
        let initialPaymentStatus = 'fully_paid';
        let initialPaidAmount = 0;

        if (paymentMethod === 'card') {
            if (!cardDetails || !cardDetails.number || !cardDetails.expiry || !cardDetails.cvv || !cardDetails.name) {
                return res.status(400).json({ message: 'All card details are required.' });
            }

            const cardNum = cardDetails.number.replace(/\s/g, '');
            if (!/^\d{13,19}$/.test(cardNum)) {
                return res.status(400).json({ message: 'Invalid card number.' });
            }

            // Luhn check
            let sum = 0, alt = false;
            for (let i = cardNum.length - 1; i >= 0; i--) {
                let n = parseInt(cardNum[i], 10);
                if (alt) { n *= 2; if (n > 9) n -= 9; }
                sum += n;
                alt = !alt;
            }
            if (sum % 10 !== 0) {
                return res.status(400).json({ message: 'Card number failed validation.' });
            }

            // Expiry check MM/YY
            const expiryMatch = cardDetails.expiry.match(/^(0[1-9]|1[0-2])\/(\d{2})$/);
            if (!expiryMatch) {
                return res.status(400).json({ message: 'Card expiry must be MM/YY format.' });
            }
            const expMonth = parseInt(expiryMatch[1], 10);
            const expYear = 2000 + parseInt(expiryMatch[2], 10);
            const now = new Date();
            if (expYear < now.getFullYear() || (expYear === now.getFullYear() && expMonth < (now.getMonth() + 1))) {
                return res.status(400).json({ message: 'Card has expired.' });
            }

            // CVV
            if (!/^\d{3,4}$/.test(cardDetails.cvv)) {
                return res.status(400).json({ message: 'CVV must be 3 or 4 digits.' });
            }

            paymentDetails = {
                cardLast4: cardNum.slice(-4),
                cardBrand: detectCardBrand(cardNum),
                transactionId: `TXN${Date.now()}`,
            };
            initialPaidAmount = 0; // We will calculate total later
        } else if (paymentMethod === 'payhere') {
            paymentDetails = {
                note: 'Pending PayHere checkout'
            };
            initialPaymentStatus = 'pending';
            initialPaidAmount = 0;
        } else {
            // For onsite/manual bookings
            paymentDetails = {
                transactionId: `MANUAL-${Date.now()}`,
                note: 'Manual booking by admin'
            };
            initialPaymentStatus = 'pending';
            initialPaidAmount = 0;
        }

        // 4. Calculate nights and total
        const isDayUse = room.package === 'day-use';
        const diffTime = Math.abs(endDate - startDate);
        const nights = isDayUse ? 0 : Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        // Base calculation
        let unitPrice = room.price;
        const subtotal = isDayUse ? unitPrice : unitPrice * nights;
        
        // Offer logic (Dynamic Offers)
        let discount = 0;
        
        // Find active offer for this room type on the check-in date
        const activeOffer = await Offer.findOne({
            isActive: true,
            startDate: { $lte: startDate },
            endDate: { $gte: startDate },
            applicableRoomTypes: room.type
        }).sort({ discountPercentage: -1 });

        if (activeOffer) {
            const discountFraction = activeOffer.discountPercentage / 100;
            const discountAmountPerUnit = unitPrice * discountFraction;
            const finalUnitPrice = unitPrice - discountAmountPerUnit;

            const offerSubtotal = unitPrice * (isDayUse ? 1 : nights);
            const offerTotal = finalUnitPrice * (isDayUse ? 1 : nights);
            
            discount = offerSubtotal - offerTotal;
        }

        const total = subtotal - discount; 

        // 4. Create booking
        const bookingId = `BK-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        
        const booking = await Booking.create({
            bookingId,
            user: userId || null,
            guestInfo,
            room: roomId,
            checkIn: startDate,
            checkOut: endDate,
            guests,
            nights,
            subtotal: subtotal,
            discount,
            total: total,
            status: paymentMethod === 'payhere' ? 'pending' : 'reserved',
            paymentMethod,
            paidAmount: paymentMethod === 'card' ? total : 0,
            paymentStatus: paymentMethod === 'card' ? 'fully_paid' : 'pending',
            paymentDetails,
            paymentDate: paymentMethod === 'card' ? new Date() : null
        });

        if (paymentMethod === 'payhere') {
            const merchantId = (process.env.PAYHERE_MERCHANT_ID || '1226209').trim();
            const merchantSecret = (process.env.PAYHERE_MERCHANT_SECRET || '3262097392333620346221091696102295398843').trim();
            
            const payhereParams = {
                sandbox: process.env.PAYHERE_SANDBOX !== 'false',
                merchant_id: merchantId,
                return_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment-success`,
                cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment-cancel`,
                notify_url: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/bookings/notify`,
                order_id: booking._id.toString(),
                items: `${room.name} - ${nights} Night(s) Stay`,
                amount: total.toFixed(2),
                currency: 'LKR',
                hash: generatePayHereHash(merchantId, booking._id.toString(), total, 'LKR', merchantSecret),
                first_name: guestInfo.firstName,
                last_name: guestInfo.lastName,
                email: guestInfo.email,
                phone: guestInfo.phone || '0771234567',
                address: 'Negombo',
                city: 'Negombo',
                country: 'Sri Lanka'
            };

            return res.status(201).json({
                success: true,
                booking,
                payhere: payhereParams
            });
        }

        // 5. Create notification for admin
        const guestName = guestInfo?.firstName
            ? `${guestInfo.firstName} ${guestInfo.lastName || ''}`
            : 'A guest';
        await createNotification({
            type: 'NEW_BOOKING',
            title: 'New Booking Received',
            message: `${guestName} booked Room ${room.roomNumber} (${room.type}) for ${nights} night(s). Total: $${total}`,
            link: `/admin/bookings`,
            metadata: { bookingId: booking._id, roomNumber: room.roomNumber }
        });

        // Room physical status remains 'available' to allow other bookings until guest checks in.

        res.status(201).json(booking);

        // 6. Send Confirmation Email
        try {
            const emailHtml = `
                <div style="font-family: 'Inter', sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff;">
                    <div style="background: linear-gradient(135deg, #0f172a, #334155); padding: 40px 20px; text-align: center; color: #ffffff;">
                        <h1 style="margin: 0; font-size: 28px; letter-spacing: -0.025em;">Booking Confirmed!</h1>
                        <p style="margin: 10px 0 0; opacity: 0.8; font-size: 16px;">Reference: ${bookingId}</p>
                    </div>
                    <div style="padding: 32px 24px;">
                        <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">Hi ${guestInfo.firstName}, thank you for choosing Dutch Point Resort. Your room booking has been successfully received and confirmed.</p>
                        
                        <div style="background-color: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                            <h3 style="margin-top: 0; margin-bottom: 16px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b;">Stay Summary</h3>
                            <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
                                <tr><td style="padding: 6px 0; color: #64748b;">Room</td><td style="padding: 6px 0; font-weight: 600; text-align: right;">${room.roomNumber} (${room.type})</td></tr>
                                <tr><td style="padding: 6px 0; color: #64748b;">Check-In</td><td style="padding: 6px 0; font-weight: 600; text-align: right;">${startDate.toLocaleDateString()}</td></tr>
                                <tr><td style="padding: 6px 0; color: #64748b;">Check-Out</td><td style="padding: 6px 0; font-weight: 600; text-align: right;">${endDate.toLocaleDateString()}</td></tr>
                                <tr><td style="padding: 6px 0; color: #64748b;">Nights</td><td style="padding: 6px 0; font-weight: 600; text-align: right;">${nights}</td></tr>
                                <tr><td style="padding: 6px 0; color: #64748b;">Guests</td><td style="padding: 6px 0; font-weight: 600; text-align: right;">${guests}</td></tr>
                            </table>
                        </div>

                        <div style="border-top: 1px solid #f1f5f9; padding-top: 20px;">
                            <table style="width: 100%; font-size: 14px;">
                                <tr><td style="padding: 4px 0;">Total Amount</td><td style="padding: 4px 0; font-weight: 600; text-align: right;">Rs. ${total.toLocaleString()}</td></tr>
                                <tr><td style="padding: 4px 0; color: #10b981;">Amount Paid</td><td style="padding: 4px 0; font-weight: 700; text-align: right; color: #10b981;">Rs. ${total.toLocaleString()}</td></tr>
                            </table>
                        </div>

                        <div style="margin-top: 32px; text-align: center;">
                            <p style="font-size: 14px; color: #64748b; margin-bottom: 20px;">We look forward to welcoming you!</p>
                            <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/profile" style="display: inline-block; background-color: #0f172a; color: #ffffff; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px;">View My Booking</a>
                        </div>
                    </div>
                    <div style="background-color: #f1f5f9; padding: 24px; text-align: center; font-size: 12px; color: #94a3b8;">
                        <p style="margin: 0;">Dutch Point Resort, Negombo, Sri Lanka</p>
                        <p style="margin: 4px 0 0;">This is an automated confirmation email.</p>
                    </div>
                </div>
            `;

            sendEmail({
                email: guestInfo.email,
                subject: `Booking Confirmed: Room ${room.roomNumber} - ${bookingId}`,
                html: emailHtml,
            }).catch(emailErr => {
                console.error('Email failed to send:', emailErr);
            });
        } catch (emailErr) {
            console.error('Email prep error:', emailErr);
        }
    } catch (error) {
        console.error('Create Booking Error:', error);
        res.status(500).json({ message: error.message });
    }
};


export const getBookings = async (req, res) => {
    try {
        const { status, page = 1, limit = 20, from, to, userId, search } = req.query;
        const query = {};

        if (status && status !== 'all') query.status = status;
        if (userId) query.user = userId;
        if (from || to) {
            query.checkIn = {};
            if (from) query.checkIn.$gte = new Date(from);
            if (to) query.checkIn.$lte = new Date(to);
        }

        if (search) {
            const matchingUsers = await User.find({
                $or: [
                    { firstName: { $regex: search, $options: 'i' } },
                    { lastName: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } }
                ]
            }).select('_id');
            const userIds = matchingUsers.map(u => u._id);

            query.$or = [
                { user: { $in: userIds } },
                { bookingId: { $regex: search, $options: 'i' } },
                { 'guestInfo.firstName': { $regex: search, $options: 'i' } },
                { 'guestInfo.lastName': { $regex: search, $options: 'i' } },
                { 'guestInfo.email': { $regex: search, $options: 'i' } }
            ];
        }

        const total = await Booking.countDocuments(query);
        const bookings = await Booking.find(query)
            .populate('user', 'firstName lastName email phone')
            .populate('room', 'name type price image roomNumber')
            .sort({ createdAt: -1 })
            .skip((page - 1) * parseInt(limit))
            .limit(parseInt(limit));

        res.json({
            bookings,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit)),
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


export const getBookingById = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id)
            .populate('user', 'firstName lastName email phone')
            .populate('room', 'name type price image roomNumber');
        if (!booking) return res.status(404).json({ message: 'Booking not found' });
        res.json(booking);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


export const updateBookingStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const valid = ['pending', 'reserved', 'checked_in', 'checked_out', 'cancelled'];
        if (!valid.includes(status)) {
            return res.status(400).json({ message: 'Invalid status value' });
        }

        const oldBooking = await Booking.findById(req.params.id).populate('room');
        if (!oldBooking) return res.status(404).json({ message: 'Booking not found' });
        
        const oldStatus = oldBooking.status;
        const room = oldBooking.room;

        if (status === 'checked_in') {
            if (oldStatus !== 'reserved') return res.status(400).json({ message: 'Only reserved bookings can be checked in.' });
            
            const todayStr = new Date().toDateString();
            const checkInDateStr = new Date(oldBooking.checkIn).toDateString();
            if (todayStr !== checkInDateStr) {
                return res.status(400).json({ message: 'Check-in is only allowed on the scheduled check-in date.' });
            }
            
            if (room.status === 'occupied' || room.status === 'maintenance') {
                return res.status(400).json({ message: 'Room is currently occupied or under maintenance.' });
            }
            
            await Room.updateMany({ roomNumber: room.roomNumber }, { $set: { status: 'occupied' } });
        }
        
        if (status === 'checked_out') {
            if (oldStatus !== 'checked_in') return res.status(400).json({ message: 'Only checked-in bookings can be checked out.' });
            
            await Room.updateMany({ roomNumber: room.roomNumber }, { $set: { status: 'available' } });
        }
        
        if (status === 'cancelled' && (oldStatus === 'reserved' || oldStatus === 'checked_in')) {
            await Room.updateMany({ roomNumber: room.roomNumber }, { $set: { status: 'available' } });
        }

        const booking = await Booking.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        )
            .populate('user', 'firstName lastName email')
            .populate('room', 'name type');

        // Notification for cancellation
        if (status === 'cancelled') {
            const guestName = booking.user
                ? `${booking.user.firstName} ${booking.user.lastName}`
                : 'A guest';
            await createNotification({
                type: 'BOOKING_CANCELLED',
                title: 'Booking Cancelled',
                message: `Booking ${booking.bookingId || booking._id} by ${guestName} has been cancelled.`,
                link: '/admin/bookings',
                metadata: { bookingId: booking._id }
            });
        }

        res.json(booking);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


export const getDashboardStats = async (req, res) => {
    try {
        const startOfToday = getStartOfTodaySL();
        const endOfToday = getEndOfTodaySL();

        const [
            totalBookings,
            pendingBookings,
            completedBookings,
            totalRooms,
            occupiedRooms,
            reservedRooms,
            freeRooms,
            bookingsToday,
        ] = await Promise.all([
            Booking.countDocuments({ createdAt: { $gte: startOfToday, $lte: endOfToday } }),
            Booking.countDocuments({ status: 'pending', createdAt: { $gte: startOfToday, $lte: endOfToday } }),
            Booking.countDocuments({ status: 'checked_out', updatedAt: { $gte: startOfToday, $lte: endOfToday } }),
            Room.countDocuments({ status: { $ne: 'maintenance' } }),
            Room.countDocuments({ status: 'occupied' }),
            Room.countDocuments({ status: 'reserved' }),
            Room.countDocuments({ status: 'available' }),
            Booking.find({ createdAt: { $gte: startOfToday, $lte: endOfToday } }).select('user guestInfo'),
        ]);

        const customerKeys = new Set();
        (bookingsToday || []).forEach(b => {
            if (b.user) customerKeys.add(b.user.toString());
            if (b.guestInfo?.email) customerKeys.add(b.guestInfo.email.toLowerCase().trim());
        });

        const totalCustomersToday = customerKeys.size;

        const totalRevenue = 0;

        res.json({
            totalBookings,
            pendingBookings,
            confirmedBookings: completedBookings,
            completedBookings,
            totalCustomers: totalCustomersToday,
            availableRooms: freeRooms,
            totalRooms,
            occupiedRooms,
            reservedRooms,
            totalRevenue,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


export const getDebugDates = async (req, res) => {
    try {
        const bookings = await Booking.find().select('createdAt status total bookingRef').limit(30);
        res.json({ bookings });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};


export const getMonthlyRevenue = async (req, res) => {
    try {
        const year = parseInt(req.query.year) || new Date().getFullYear();

        const [bookingStats] = await Promise.all([
            Booking.aggregate([
                {
                    $match: {
                        status: { $in: ['reserved', 'checked_in', 'checked_out'] },
                        createdAt: {
                            $gte: new Date(`${year}-01-01T00:00:00.000Z`),
                            $lte: new Date(`${year}-12-31T23:59:59.999Z`),
                        },
                    },
                },
                {
                    $group: {
                        _id: { $month: { date: '$createdAt', timezone: '+05:30' } },
                        revenue: { $sum: '$total' },
                        count: { $sum: 1 },
                    },
                },
            ]),
        ]);

        const monthlyData = Array.from({ length: 12 }, (_, i) => {
            const m = i + 1;
            const b = bookingStats.find(x => x._id === m);
            return {
                month: m,
                revenue: (b?.revenue || 0),
                roomRevenue: b?.revenue || 0,
                count: (b?.count || 0),
            };
        });

        res.json(monthlyData);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const confirmBookingPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const { transactionId } = req.body;

        const booking = await Booking.findById(id).populate('room');
        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        booking.status = 'reserved';
        booking.paymentStatus = 'fully_paid';
        booking.paidAmount = booking.total;
        booking.paymentDate = new Date();
        booking.paymentDetails = {
            transactionId: transactionId || `TXN-PAYHERE-${Date.now()}`,
            method: 'payhere'
        };

        await booking.save();

        const guestName = booking.guestInfo?.firstName
            ? `${booking.guestInfo.firstName} ${booking.guestInfo.lastName || ''}`
            : 'A guest';

        await createNotification({
            type: 'NEW_BOOKING',
            title: 'New Booking Confirmed (PayHere)',
            message: `${guestName} booked Room ${booking.room.roomNumber} (${booking.room.type}) for ${booking.nights} night(s). Total: Rs. ${booking.total}`,
            link: `/admin/bookings`,
            metadata: { bookingId: booking._id, roomNumber: booking.room.roomNumber }
        });

        try {
            const emailHtml = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px; color: #0f172a;">
                    <div style="text-align: center; margin-bottom: 32px;">
                        <h2 style="color: #0f172a; margin: 0 0 8px; font-style: italic; font-weight: 800; font-size: 24px;">DUTCH POINT RESORT</h2>
                        <p style="color: #64748b; margin: 0; font-size: 12px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase;">Booking Confirmation</p>
                    </div>

                    <div style="background-color: #f8fafc; border-radius: 12px; padding: 24px; margin-bottom: 24px; border: 1px solid #f1f5f9;">
                        <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 4px;">Booking ID</div>
                        <div style="font-size: 18px; font-weight: 800; color: #0f172a; font-family: monospace;">${booking.bookingId}</div>
                    </div>

                    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">Hi ${booking.guestInfo.firstName}, thank you for choosing Dutch Point Resort. Your room booking has been successfully received and confirmed via PayHere.</p>
                    
                    <div style="background-color: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                        <h3 style="margin-top: 0; margin-bottom: 16px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b;">Stay Summary</h3>
                        <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
                            <tr><td style="padding: 6px 0; color: #64748b;">Room</td><td style="padding: 6px 0; font-weight: 600; text-align: right;">${booking.room.roomNumber} (${booking.room.type})</td></tr>
                            <tr><td style="padding: 6px 0; color: #64748b;">Check-In</td><td style="padding: 6px 0; font-weight: 600; text-align: right;">${new Date(booking.checkIn).toLocaleDateString()}</td></tr>
                            <tr><td style="padding: 6px 0; color: #64748b;">Check-Out</td><td style="padding: 6px 0; font-weight: 600; text-align: right;">${new Date(booking.checkOut).toLocaleDateString()}</td></tr>
                            <tr><td style="padding: 6px 0; color: #64748b;">Nights</td><td style="padding: 6px 0; font-weight: 600; text-align: right;">${booking.nights}</td></tr>
                            <tr><td style="padding: 6px 0; color: #64748b;">Guests</td><td style="padding: 6px 0; font-weight: 600; text-align: right;">${booking.guests}</td></tr>
                        </table>
                    </div>

                    <div style="border-top: 1px solid #f1f5f9; padding-top: 20px;">
                        <table style="width: 100%; font-size: 14px;">
                            <tr><td style="padding: 4px 0;">Total Amount</td><td style="padding: 4px 0; font-weight: 600; text-align: right;">Rs. ${booking.total.toLocaleString()}</td></tr>
                            <tr><td style="padding: 4px 0; color: #10b981;">Amount Paid (PayHere)</td><td style="padding: 4px 0; font-weight: 700; text-align: right; color: #10b981;">Rs. ${booking.total.toLocaleString()}</td></tr>
                        </table>
                    </div>

                    <div style="margin-top: 32px; text-align: center;">
                        <p style="font-size: 14px; color: #64748b; margin-bottom: 20px;">We look forward to welcoming you!</p>
                        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/profile" style="display: inline-block; background-color: #0f172a; color: #ffffff; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px;">View My Booking</a>
                    </div>
                </div>
            `;

            sendEmail({
                email: booking.guestInfo.email,
                subject: `Booking Confirmed: Room ${booking.room.roomNumber} - ${booking.bookingId}`,
                html: emailHtml,
            }).catch(emailErr => {
                console.error('Email failed to send:', emailErr);
            });
        } catch (emailErr) {
            console.error('Email prep error:', emailErr);
        }

        res.status(200).json({
            success: true,
            message: 'Booking payment confirmed successfully',
            booking
        });
    } catch (error) {
        console.error('Confirm Booking Payment Error:', error);
        res.status(500).json({ message: error.message });
    }
};
