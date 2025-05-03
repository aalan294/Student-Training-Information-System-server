const Student = require('../MODELS/studentSchema');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const TrainingProgress = require('../MODELS/trainingProcessSchema');
const mongoose = require('mongoose');

const loginStudent = async (req, res) => {
  try {
    const { regNo, password } = req.body;

    // Check if student exists
    const student = await Student.findOne({ regNo });
    if (!student) return res.status(404).json({ message: 'Student not found' });

    // Compare passwords
    const isMatch = await bcrypt.compare(password, student.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    // Generate JWT
    const token = jwt.sign(
      {
        id: student._id,
        role: 'student'
      },
      process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      student: {
        name: student.name,
        regNo: student.regNo,
        email: student.email,
        batch: student.batch,
        _id: student._id,
        passoutYear: student.passoutYear,
        leetcodeId: student.leetcodeId,
        codechefId: student.codechefId
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get full student details
const getStudentDetails = async (req, res) => {
  try {
    const { studentId } = req.params;

    // Validate if studentId is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ 
        message: 'Invalid student ID format',
        error: 'Student ID must be a valid MongoDB ObjectId'
      });
    }

    const student = await Student.findById(studentId)
      .select('-password')
      .populate('trainings.moduleId', 'title isCompleted');

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const progress = await TrainingProgress.find({ student: studentId })
      .populate('training', 'title isCompleted');

    res.status(200).json({
      student,
      progress
    });
  } catch (error) {
    console.error('Error in getStudentDetails:', error);
    res.status(500).json({ 
      message: 'Error fetching student details', 
      error: error.message 
    });
  }
};

// Get student details with specific module performance
const getStudentModulePerformance = async (req, res) => {
  try {
    const { studentId, moduleId } = req.params;

    // Find student and populate the specific module
    const student = await Student.findById(studentId)
      .select('-password')
      .populate({
        path: 'trainings.moduleId',
        match: { _id: moduleId },
        select: 'title description durationDays examsCount'
      });

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Find the specific training progress for this module
    const trainingProgress = await TrainingProgress.findOne({
      student: studentId,
      training: moduleId
    });

    if (!trainingProgress) {
      return res.status(404).json({ message: 'No training progress found for this module' });
    }

    // Calculate average score
    const examScores = trainingProgress.examScores;
    const totalScore = examScores.reduce((sum, exam) => sum + exam.score, 0);
    const averageScore = examScores.length > 0 ? totalScore / examScores.length : 0;

    // Calculate attendance percentage
    const attendance = trainingProgress.attendance;
    const totalDays = attendance.length;
    const presentDays = attendance.filter(day => day.present).length;
    const attendancePercentage = totalDays > 0 ? (presentDays / totalDays) * 100 : 0;

    // Create the response object
    const response = {
      student: {
        _id: student._id,
        name: student.name,
        regNo: student.regNo,
        email: student.email,
        batch: student.batch,
        passoutYear: student.passoutYear
      },
      module: student.trainings.find(t => t.moduleId?._id.toString() === moduleId)?.moduleId,
      performance: {
        attendance: {
          totalDays,
          presentDays,
          percentage: attendancePercentage
        },
        examScores: trainingProgress.examScores,
        averageScore,
        lastUpdated: trainingProgress.updatedAt
      }
    };

    res.status(200).json({
      message: 'Student module performance retrieved successfully',
      data: response
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching student module performance', error: error.message });
  }
};

// Get module leaderboard
const getModuleLeaderboard = async (req, res) => {
  try {
    const { moduleId } = req.params;
    const { studentId } = req.query;

    // Validate moduleId
    if (!mongoose.Types.ObjectId.isValid(moduleId)) {
      return res.status(400).json({ 
        message: 'Invalid module ID format',
        error: 'Module ID must be a valid MongoDB ObjectId'
      });
    }

    // Find all students enrolled in this module with their training progress
    const students = await Student.find(
      { 'trainings.moduleId': moduleId },
      'name regNo'
    );

    // Get training progress for all students
    const leaderboardData = await Promise.all(
      students.map(async (student) => {
        const progress = await TrainingProgress.findOne({
          student: student._id,
          training: moduleId
        });

        if (!progress) return null;

        // Get all exam scores
        const examScores = progress.examScores.map(score => ({
          examNumber: score.exam,
          score: score.score
        }));

        // Calculate average score
        const averageScore = progress.averageScore || 0;

        return {
          studentId: student._id,
          name: student.name,
          regNo: student.regNo,
          examScores,
          averageScore,
          totalScore: progress.totalScore || 0
        };
      })
    );

    // Filter out null entries
    const validEntries = leaderboardData.filter(entry => entry !== null);

    // Sort by average score by default
    const sortedLeaderboard = validEntries.sort((a, b) => b.averageScore - a.averageScore);

    // Add rank to each entry
    const leaderboardWithRank = sortedLeaderboard.map((entry, index) => ({
      ...entry,
      rank: index + 1
    }));

    // Find current student's position
    const currentStudentPosition = leaderboardWithRank.findIndex(
      entry => entry.studentId.toString() === studentId
    );

    res.status(200).json({
      message: 'Leaderboard retrieved successfully',
      leaderboard: leaderboardWithRank,
      currentStudent: currentStudentPosition !== -1 ? {
        ...leaderboardWithRank[currentStudentPosition],
        position: currentStudentPosition + 1
      } : null,
      totalStudents: leaderboardWithRank.length
    });

  } catch (error) {
    res.status(500).json({ 
      message: 'Error fetching leaderboard', 
      error: error.message 
    });
  }
};

module.exports = {
  loginStudent,
  getStudentDetails,
  getStudentModulePerformance,
  getModuleLeaderboard
};
