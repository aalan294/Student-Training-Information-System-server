const Staff = require('../MODELS/staffSchema');
const Venue = require('../MODELS/venueSchema');
const Student = require('../MODELS/studentSchema');
const TrainingProgress = require('../MODELS/trainingProcessSchema');
const { sendAbsenceEmail } = require('../services/emailService');
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
    const { date, session, attendanceData } = req.body; // session: 'forenoon' or 'afternoon', attendanceData: array of {studentId, present, od}
    const staff = await Staff.findById(staffId);
    if (!staff || !staff.venueId) return res.status(404).json({ message: 'Staff or assigned venue not found' });
    
    const progresses = await TrainingProgress.find({ venueId: staff.venueId }).populate('student', 'email');
    const attendanceDate = new Date(date);
    if (isNaN(attendanceDate.getTime())) {
      return res.status(400).json({ message: 'Invalid date format' });
    }

    // Mark attendance for each student
    const updatePromises = progresses.map(async (progress) => {
      const studentAttendance = attendanceData.find(a => a.studentId === progress.student._id.toString());
      if (!studentAttendance) return { studentId: progress.student._id, status: 'skipped' };

      const existingIndex = progress.attendance.findIndex(a => 
        a.date.toISOString().split('T')[0] === attendanceDate.toISOString().split('T')[0]
      );

      if (existingIndex !== -1) {
        // Update existing attendance record
        progress.attendance[existingIndex][session] = {
          present: studentAttendance.present,
          od: studentAttendance.od || false
        };
      } else {
        // Create new attendance record
        const newAttendance = {
          date: attendanceDate,
          forenoon: { present: false, od: false },
          afternoon: { present: false, od: false }
        };
        newAttendance[session] = {
          present: studentAttendance.present,
          od: studentAttendance.od || false
        };
        progress.attendance.push(newAttendance);
      }
      
      await progress.save();
      return { 
        student: progress.student, 
        status: 'success',
        present: studentAttendance.present,
        od: studentAttendance.od || false
      };
    });

    const results = await Promise.all(updatePromises);

    // Send emails to absent students
    const absentStudentEmails = results
      .filter(result => result.status === 'success' && !result.present && !result.od)
      .map(result => result.student.email);

    if (absentStudentEmails.length > 0) {
      sendAbsenceEmail(absentStudentEmails, date, session);
    }

    res.status(200).json({ 
      message: `${session} attendance marked successfully`, 
      results: results.map(r => ({ ...r, student: r.student ? r.student._id : null })),
      session,
      date: attendanceDate.toISOString().split('T')[0]
    });
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
            forenoon: { present: [], absent: [], od: [] },
            afternoon: { present: [], absent: [], od: [] }
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

        // Process forenoon session
        if (record.forenoon) {
          if (record.forenoon.od) {
            attendanceByDate[dateStr].forenoon.od.push(studentInfo);
          } else if (record.forenoon.present) {
            attendanceByDate[dateStr].forenoon.present.push(studentInfo);
          } else {
            attendanceByDate[dateStr].forenoon.absent.push(studentInfo);
          }
        }

        // Process afternoon session
        if (record.afternoon) {
          if (record.afternoon.od) {
            attendanceByDate[dateStr].afternoon.od.push(studentInfo);
          } else if (record.afternoon.present) {
            attendanceByDate[dateStr].afternoon.present.push(studentInfo);
          } else {
            attendanceByDate[dateStr].afternoon.absent.push(studentInfo);
          }
        }
      });
    });

    // Convert to array and calculate daily summary for each day
    const attendanceHistory = Object.values(attendanceByDate).map(day => {
      const allStudentIds = new Set([
        ...day.forenoon.present.map(s => s.id.toString()),
        ...day.forenoon.absent.map(s => s.id.toString()),
        ...day.forenoon.od.map(s => s.id.toString()),
        ...day.afternoon.present.map(s => s.id.toString()),
        ...day.afternoon.absent.map(s => s.id.toString()),
        ...day.afternoon.od.map(s => s.id.toString()),
      ]);

      let present = 0;
      let absent = 0; // Absent for both sessions
      let onDuty = 0;
      let partial = 0; // e.g., Present in one, absent in other

      allStudentIds.forEach(studentId => {
        const isForenoonPresent = day.forenoon.present.some(s => s.id.toString() === studentId);
        const isForenoonAbsent = day.forenoon.absent.some(s => s.id.toString() === studentId);
        const isForenoonOD = day.forenoon.od.some(s => s.id.toString() === studentId);

        const isAfternoonPresent = day.afternoon.present.some(s => s.id.toString() === studentId);
        const isAfternoonAbsent = day.afternoon.absent.some(s => s.id.toString() === studentId);
        const isAfternoonOD = day.afternoon.od.some(s => s.id.toString() === studentId);

        if (isForenoonOD || isAfternoonOD) {
          onDuty++;
        } else if (isForenoonAbsent && isAfternoonAbsent) {
          absent++;
        } else if (isForenoonPresent && isAfternoonPresent) {
          present++;
        } else if (isForenoonPresent || isAfternoonPresent) {
          if ((isForenoonPresent && isAfternoonAbsent) || (isForenoonAbsent && isAfternoonPresent)) {
            partial++;
          } else {
            present++;
          }
        }
      });
      
      return {
        ...day,
        summary: {
          present,
          absent,
          onDuty,
          partial,
          totalStudents: allStudentIds.size
        }
      };
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

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