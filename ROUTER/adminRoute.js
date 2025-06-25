const express = require('express');
const router = express.Router();
const adminController = require('../CONTROLLER/adminController');
const multer = require('multer');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

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
router.route('/bulk-register-with-details')
    .post(upload.single('excel'), adminController.bulkRegisterWithDetails);
router.route('/students')
    .get(adminController.getAllStudents);
router.route('/student/:studentId')
    .delete(adminController.deleteStudent);
router.route('/students/module/:moduleId')
    .get(adminController.getStudentsByModule);

// Training module management routes
router.route('/modules')
    .get(adminController.getAllModules)
    .post(adminController.addTrainingModule);
router.route('/modules/:moduleId')
    .put(adminController.updateModuleDetails);
router.route('/modules/:moduleId/complete')
    .put(adminController.markModuleAsCompleted);

// Score management routes
router.route('/upload-scores')
    .post(upload.single('marksFile'), adminController.bulkUploadScores);
router.route('/upload-score')
    .post(adminController.uploadIndividualScore);

// Attendance management route
router.post('/mark-attendance', adminController.markAttendanceByAdmin);
router.get('/existing-attendance', adminController.getExistingAttendance);
router.route('/attendance')
    .post(adminController.updateAttendance);

// Attendance history for all venues
router.get('/attendance-history', adminController.getAllVenuesAttendanceHistory);

// Batch update route
router.route('/update-batch')
    .put(adminController.updateStudentsBatch);

// Staff management routes
router.route('/register-staff')
    .post(adminController.registerStaff);
router.route('/staff')
    .get(adminController.getAllStaff);
router.route('/staff/assign')
    .post(adminController.assignStaffToVenue);
router.route('/staff/unassign')
    .post(adminController.unassignStaffFromVenue);
router.route('/staff/emergency-unassign-all')
    .post(adminController.emergencyUnassignAll);

// Venue management routes
router.route('/venues')
    .post(adminController.registerVenue)
    .get(adminController.getAllVenues);

module.exports = router;