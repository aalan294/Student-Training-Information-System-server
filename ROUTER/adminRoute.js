const express = require('express');
const router = express.Router();
const adminController = require('../CONTROLLER/adminController');

// Admin authentication routes
router.route('/register')
    .post(adminController.registerAdmin);
router.route('/login')
    .post(adminController.loginAdmin);

// Student management routes
router.route('/bulk-register')
    .post(require('../MIDDLEWARE/bulkStudentRegister'), adminController.bulkRegisterStudents);
router.route('/register-student')
    .post(adminController.registerStudent);
router.route('/students')
    .get(adminController.getAllStudents);
router.route('/students/module/:moduleId')
    .get(adminController.getStudentsByModule);

// Training module management routes
router.route('/modules')
    .get(adminController.getAllModules)
    .post(adminController.addTrainingModule);
router.route('/modules/:id')
    .put(adminController.updateModule);

module.exports = router;