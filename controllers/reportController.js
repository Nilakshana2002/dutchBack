import Booking from '../models/Booking.js';
import Room from '../models/Room.js';
import Employee from '../models/Employee.js';
import Order from '../models/Order.js';

import StockLog from '../models/StockLog.js';
import Attendance from '../models/Attendance.js';
import Payroll from '../models/Payroll.js';


export const getReportSummary = async (req, res) => {
    try {
        const { from, to } = req.query;
        const dateFilter = {};
        if (from || to) {
            dateFilter.createdAt = {};
            if (from) dateFilter.createdAt.$gte = new Date(`${from}T00:00:00.000+05:30`);
            if (to) {
                dateFilter.createdAt.$lte = new Date(`${to}T23:59:59.999+05:30`);
            }
        }

        const [
            revenueResult, 
            foodRevenueResult,
            eventRevenueResult,
            payrollResult, 
            inventoryExpenseResult,
            bookingsByStatus, 
            roomsByStatus
        ] = await Promise.all([
          
            Booking.aggregate([
                { $match: { status: { $in: ['reserved', 'checked_in', 'checked_out'] }, ...dateFilter } },
                { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } },
            ]),
            
            Order.aggregate([
                { $match: { status: { $in: ['paid', 'preparing', 'delivered'] }, ...dateFilter } },
                { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } },
            ]),

            Payroll.aggregate([
                {
                    $match: {
                        status: 'Paid',
                        paidAt: dateFilter.createdAt ? {
                            $gte: dateFilter.createdAt.$gte,
                            $lte: dateFilter.createdAt.$lte
                        } : {
                            $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                            $lte: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59, 999),
                        }
                    }
                },
                { $group: { _id: null, total: { $sum: '$netPay' } } }
            ]),
          
            StockLog.aggregate([
                { $match: { changeType: { $in: ['IN', 'OUT'] }, ...dateFilter } },
                {
                    $lookup: {
                        from: 'inventories',
                        localField: 'item',
                        foreignField: '_id',
                        as: 'itemData'
                    }
                },
                {
                    $addFields: {
                        effectiveUnitCost: {
                            $cond: {
                                if: { $gt: [{ $ifNull: ['$unitCost', 0] }, 0] },
                                then: '$unitCost',
                                else: { $ifNull: [{ $arrayElemAt: ['$itemData.price', 0] }, 0] }
                            }
                        }
                    }
                },
                { $group: { _id: null, total: { $sum: { $multiply: [{ $ifNull: ['$quantity', 0] }, '$effectiveUnitCost'] } } } },
            ]),
            Booking.aggregate([
                { $match: dateFilter },
                { $group: { _id: '$status', count: { $sum: 1 } } },
            ]),
            Room.aggregate([
                { $group: { _id: '$status', count: { $sum: 1 } } },
            ])
        ]);

        const roomRevenue = revenueResult[0]?.total || 0;
        const foodRevenue = foodRevenueResult[0]?.total || 0;
        const totalRevenue = roomRevenue + foodRevenue;
        
        const actualPayroll = payrollResult[0]?.total || 0;

        const inventoryExpenses = inventoryExpenseResult[0]?.total || 0;
        const operationalExpenses = actualPayroll + inventoryExpenses;
        
        const netProfit = totalRevenue - operationalExpenses;

        const totalRooms = roomsByStatus.reduce((s, r) => s + r.count, 0);
        const occupiedRooms = roomsByStatus.find((r) => r._id === 'occupied')?.count || 0;
        const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

        res.json({
            totalRevenue,
            roomRevenue,
            foodRevenue,
            eventRevenue,
            operationalExpenses,
            monthlySalaries: actualPayroll,
            inventoryExpenses,
            netProfit,
            bookingCount: revenueResult[0]?.count || 0,
            foodOrderCount: foodRevenueResult[0]?.count || 0,
            occupancyRate,
            bookingsByStatus,
            roomsByStatus,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


export const getMonthlyRevenue = async (req, res) => {
    try {
        const year = parseInt(req.query.year) || new Date().getFullYear();

        const [roomRevenue, foodRevenue, payrollStats, inventoryStats] = await Promise.all([
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
                { $group: { _id: { $month: { date: '$createdAt', timezone: '+05:30' } }, revenue: { $sum: '$total' }, count: { $sum: 1 } } },
            ]),
            Order.aggregate([
                {
                    $match: {
                        status: { $in: ['paid', 'preparing', 'delivered'] },
                        createdAt: {
                            $gte: new Date(`${year}-01-01T00:00:00.000Z`),
                            $lte: new Date(`${year}-12-31T23:59:59.999Z`),
                        },
                    },
                },
                { $group: { _id: { $month: { date: '$createdAt', timezone: '+05:30' } }, revenue: { $sum: '$total' }, count: { $sum: 1 } } },
            ]),

            Payroll.aggregate([
                {
                    $match: {
                        status: 'Paid',
                        paidAt: {
                            $gte: new Date(`${year}-01-01T00:00:00.000Z`),
                            $lte: new Date(`${year}-12-31T23:59:59.999Z`),
                        },
                    },
                },
                { $group: { _id: { $month: { date: '$paidAt', timezone: '+05:30' } }, total: { $sum: '$netPay' } } },
            ]),
            StockLog.aggregate([
                {
                    $match: {
                        changeType: { $in: ['IN', 'OUT'] },
                        createdAt: {
                            $gte: new Date(`${year}-01-01T00:00:00.000Z`),
                            $lte: new Date(`${year}-12-31T23:59:59.999Z`),
                        },
                    },
                },
                {
                    $lookup: {
                        from: 'inventories',
                        localField: 'item',
                        foreignField: '_id',
                        as: 'itemData'
                    }
                },
                {
                    $addFields: {
                        effectiveUnitCost: {
                            $cond: {
                                if: { $gt: [{ $ifNull: ['$unitCost', 0] }, 0] },
                                then: '$unitCost',
                                else: { $ifNull: [{ $arrayElemAt: ['$itemData.price', 0] }, 0] }
                            }
                        }
                    }
                },
                { $group: { _id: { $month: { date: '$createdAt', timezone: '+05:30' } }, total: { $sum: { $multiply: [{ $ifNull: ['$quantity', 0] }, '$effectiveUnitCost'] } } } },
            ]),
        ]);

        const monthlyData = Array.from({ length: 12 }, (_, i) => {
            const month = i + 1;
            const r = roomRevenue.find(x => x._id === month)?.revenue || 0;
            const f = foodRevenue.find(x => x._id === month)?.revenue || 0;
            
            const pay = payrollStats.find(x => x._id === month)?.total || 0;
            const inv = inventoryStats.find(x => x._id === month)?.total || 0;
            
            const rev = r + f;
            const exp = pay + inv;
            const netProfit = rev - exp;

            return { 
                month, 
                revenue: rev, 
                expenses: exp,
                netProfit: netProfit
            };
        });

        res.json(monthlyData);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getBookingReport = async (req, res) => {
    try {
        const { from, to } = req.query;
        const dateFilter = {};
        if (from || to) {
            dateFilter.createdAt = {};
            if (from) dateFilter.createdAt.$gte = new Date(`${from}T00:00:00.000+05:30`);
            if (to) {
                dateFilter.createdAt.$lte = new Date(`${to}T23:59:59.999+05:30`);
            }
        }

        const [bookings, orders] = await Promise.all([
            Booking.find(dateFilter)
                .populate('room', 'roomNumber type')
                .populate('user', 'firstName lastName email')
                .lean(),
            Order.find(dateFilter)
                .lean()
        ]);

        const bookingRows = bookings.map(b => ({
            date: b.createdAt,
            type: 'Room Booking',
            ref: b.bookingId,
            customerName: b.guestInfo ? `${b.guestInfo.firstName} ${b.guestInfo.lastName}`.trim() : (b.user ? `${b.user.firstName} ${b.user.lastName}`.trim() : 'Guest'),
            email: b.guestInfo?.email || b.user?.email || '',
            details: b.room ? `Room ${b.room.roomNumber} (${b.room.type})` : 'Room Booking',
            status: b.status,
            amount: b.total
        }));


        const orderRows = orders.map(o => ({
            date: o.createdAt,
            type: 'Food Order',
            ref: o._id.toString().substring(18).toUpperCase(),
            customerName: o.guestInfo?.name || 'Guest',
            email: o.guestInfo?.email || '',
            details: o.items ? o.items.map(i => `${i.name} x${i.quantity}`).join(', ') : 'Food Order',
            status: o.status,
            amount: o.total
        }));

        const combined = [...bookingRows, ...orderRows].sort((a, b) => new Date(b.date) - new Date(a.date));

        res.json(combined);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
