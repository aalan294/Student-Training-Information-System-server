const express = require('express');
const router = express.Router();
const studentController = require('../CONTROLLER/studentController');

// Authentication routes
router.route('/login')
    .post(studentController.loginStudent);

// Student details routes
router.route('/:studentId')
    .get(studentController.getStudentDetails);

// Student module performance route
router.route('/:studentId/module/:moduleId')
    .get(studentController.getStudentModulePerformance);

// Module leaderboard route
router.route('/module/:moduleId/leaderboard')
    .get(studentController.getModuleLeaderboard);

module.exports = router;