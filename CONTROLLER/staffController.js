const Staff = require('../MODELS/staffSchema');
const Venue = require('../MODELS/venueSchema');
const Student = require('../MODELS/studentSchema');
const TrainingProgress = require('../MODELS/trainingProcessSchema');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'staffsecret';

// Staff Login
const loginStaff = async (req, res) => {
  try {
    const { email, password } = req.body;
    const staff = await Staff.findOne({ email });
    if (!staff) return res.status(404).json({ message: 'Staff not found' });
    const isMatch = await bcrypt.compare(password, staff.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });
    const token = jwt.sign({ id: staff._id, email: staff.email }, JWT_SECRET, { expiresIn: '7d' });
    res.status(200).json({
      message: 'Login successful',
      token,
      staff: {
        id: staff._id,
        name: staff.name,
        email: staff.email,
        venueId: staff.venueId,
        status: staff.status
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during staff login', error: error.message });
  }
};

// Get Staff Details (with assigned venue)
const getStaffDetails = async (req, res) => {
  try {
    const staffId = req.user.id;
    const staff = await Staff.findById(staffId).populate('venueId', 'name capacity status');
    if (!staff) return res.status(404).json({ message: 'Staff not found' });
    res.status(200).json({
      staff: {
        id: staff._id,
        name: staff.name,
        email: staff.email,
        status: staff.status,
        venue: staff.venueId
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching staff details', error: error.message });
  }
};

// Get Students for Staff's Venue
const getVenueStudents = async (req, res) => {
  try {
    const staffId = req.user.id;
    const staff = await Staff.findById(staffId);
    if (!staff || !staff.venueId) return res.status(404).json({ message: 'Staff or assigned venue not found' });
    // Find all students with a training progress for this venue
    const progresses = await TrainingProgress.find({ venueId: staff.venueId }).populate('student', '-password');
    const students = progresses.map(p => p.student);
    res.status(200).json({ students });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching students for venue', error: error.message });
  }
};

// Mark Attendance for Students in Staff's Venue
const markAttendance = async (req, res) => {
  try {
    const staffId = req.user.id;
    const { date, presentStudentIds } = req.body; // presentStudentIds: array of student IDs
    const staff = await Staff.findById(staffId);
    if (!staff || !staff.venueId) return res.status(404).json({ message: 'Staff or assigned venue not found' });
    const progresses = await TrainingProgress.find({ venueId: staff.venueId });
    const attendanceDate = new Date(date);
    if (isNaN(attendanceDate.getTime())) {
      return res.status(400).json({ message: 'Invalid date format' });
    }
    // Mark attendance for each student
    const updatePromises = progresses.map(async (progress) => {
      const isPresent = presentStudentIds.includes(progress.student.toString());
      const existingIndex = progress.attendance.findIndex(a => a.date.toISOString().split('T')[0] === attendanceDate.toISOString().split('T')[0]);
      if (existingIndex !== -1) {
        progress.attendance[existingIndex].present = isPresent;
      } else {
        progress.attendance.push({ date: attendanceDate, present: isPresent });
      }
      await progress.save();
      return { studentId: progress.student, present: isPresent };
    });
    const results = await Promise.all(updatePromises);
    res.status(200).json({ message: 'Attendance marked', results });
  } catch (error) {
    res.status(500).json({ message: 'Error marking attendance', error: error.message });
  }
};

// Get Attendance History for Venue Students
const getVenueAttendanceHistory = async (req, res) => {
  try {
    const staffId = req.user.id;
    const staff = await Staff.findById(staffId);
    if (!staff || !staff.venueId) {
      return res.status(404).json({ message: 'Staff or assigned venue not found' });
    }

    // Get all training progresses for this venue
    const progresses = await TrainingProgress.find({ venueId: staff.venueId })
      .populate('student', 'name regNo email batch department');

    // Group attendance by date
    const attendanceByDate = {};
    progresses.forEach(progress => {
      progress.attendance.forEach(record => {
        const dateStr = record.date.toISOString().split('T')[0];
        if (!attendanceByDate[dateStr]) {
          attendanceByDate[dateStr] = {
            date: dateStr,
            present: [],
            absent: []
          };
        }
        const studentInfo = {
          id: progress.student._id,
          name: progress.student.name,
          regNo: progress.student.regNo,
          email: progress.student.email,
          batch: progress.student.batch,
          department: progress.student.department
        };
        if (record.present) {
          attendanceByDate[dateStr].present.push(studentInfo);
        } else {
          attendanceByDate[dateStr].absent.push(studentInfo);
        }
      });
    });

    // Convert to array and sort by date
    const attendanceHistory = Object.values(attendanceByDate)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    res.status(200).json({ attendanceHistory });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching attendance history', error: error.message });
  }
};

// Venue Leaderboard (students in staff's venue)
const venueLeaderboard = async (req, res) => {
  try {
    const staffId = req.user.id;
    const staff = await Staff.findById(staffId);
    if (!staff || !staff.venueId) return res.status(404).json({ message: 'Staff or assigned venue not found' });
    
    // Get all progresses for this venue
    const progresses = await TrainingProgress.find({ venueId: staff.venueId })
      .populate('student', 'name regNo email batch department passoutYear');
    
    // Calculate attendance stats and sort by averageScore
    const leaderboard = progresses
      .map(p => {
        const totalDays = p.attendance.length;
        const presentDays = p.attendance.filter(a => a.present).length;
        return {
          student: p.student,
          averageScore: p.averageScore,
          attendance: {
            present: presentDays,
            total: totalDays,
            percentage: totalDays ? Math.round((presentDays / totalDays) * 100) : 0
          }
        };
      })
      .sort((a, b) => b.averageScore - a.averageScore);
    
    res.status(200).json({ leaderboard });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching venue leaderboard', error: error.message });
  }
};

module.exports = {
  loginStaff,
  getStaffDetails,
  getVenueStudents,
  markAttendance,
  venueLeaderboard,
  getVenueAttendanceHistory
}; 