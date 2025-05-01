const Student = require('../MODELS/studentSchema');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const TrainingProgress = require('../MODELS/trainingProcessSchema');

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

    // Find student and populate trainings
    const student = await Student.findById(studentId)
      .select('-password')
      .populate({
        path: 'trainings.moduleId',
        select: 'title description durationDays examsCount'
      });

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Get training progress for each module
    const studentWithProgress = await Promise.all(
      student.trainings.map(async (training) => {
        const progress = await TrainingProgress.findOne({
          student: studentId,
          training: training.moduleId._id
        });

        return {
          ...training.toObject(),
          progress: progress || null
        };
      })
    );

    // Create the final response object
    const response = {
      ...student.toObject(),
      trainings: studentWithProgress
    };

    res.status(200).json({
      message: 'Student details retrieved successfully',
      student: response
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching student details', error: error.message });
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

module.exports = {
  loginStudent,
  getStudentDetails,
  getStudentModulePerformance
};
