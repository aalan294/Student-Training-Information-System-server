const express = require('express');
const router = express.Router();

router.route('/register')
    .post(require('../CONTROLLER/adminController').registerAdmin);
router.route('/login')
    .post(require('../CONTROLLER/adminController').loginAdmin);
router.route('/bulk-register')
    .post(require('../MIDDLEWARE/bulkStudentRegister'),require('../CONTROLLER/adminController').bulkRegisterStudents)
router.route('/register-student')
    .post(require('../CONTROLLER/adminController').registerStudent)

module.exports = router;