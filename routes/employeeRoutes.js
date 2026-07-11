import express from 'express';
import {
    getEmployees,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    getEmployeeQR,
} from '../controllers/employeeController.js';
import {
    scanAttendance,
    getAttendance,
    getTodayAttendance,
    getAttendanceReport,
    updateAttendance,
    getPayroll,
} from '../controllers/attendanceController.js';

const router = express.Router();

// Employee routes
router.get('/staff', getEmployees);
router.post('/staff', createEmployee);
router.put('/staff/:id', updateEmployee);
router.delete('/staff/:id', deleteEmployee);
router.get('/staff/:id/qr', getEmployeeQR);

// Attendance routes
router.post('/attendance/scan', scanAttendance);
router.get('/attendance/today', getTodayAttendance);
router.get('/attendance/report', getAttendanceReport);
router.get('/attendance', getAttendance);
router.put('/attendance/:id', updateAttendance);

// Payroll routes
router.get('/payroll', getPayroll);

export default router;
