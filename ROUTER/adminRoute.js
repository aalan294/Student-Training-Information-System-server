const express = require('express');
const router = express.Router();

router.route('/register')
    .post(require('../CONTROLLER/adminController').registerAdmin);
router.route('/login')
    .post(require('../CONTROLLER/adminController').loginAdmin);

module.exports = router;