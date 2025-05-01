const express = require('express');
const router = express.Router();

router.route('/login')
    .post(require('../CONTROLLER/studentController').loginStudent);

module.exports = router;