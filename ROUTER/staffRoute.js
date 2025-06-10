const express = require('express');
const router = express.Router();
const staffController = require('../CONTROLLER/staffController');
const staffAuth = require('../MIDDLEWARE/staffAuth');

// Public
router.post('/login', staffController.loginStaff);

// Protected
router.get('/me', staffAuth, staffController.getStaffDetails);
router.get('/venue-students', staffAuth, staffController.getVenueStudents);
router.post('/mark-attendance', staffAuth, staffController.markAttendance);
router.get('/venue-leaderboard', staffAuth, staffController.venueLeaderboard);
router.get('/attendance-history', staffAuth, staffController.getVenueAttendanceHistory);

module.exports = router; 