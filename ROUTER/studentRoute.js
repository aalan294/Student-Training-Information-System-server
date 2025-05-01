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

module.exports = router;