const Admin = require('../MODELS/adminSchema');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Student = require('../MODELS/studentSchema');
const Module = require('../MODELS/moduleSchema');
const TrainingProgress = require('../MODELS/trainingProcessSchema');
const XLSX = require('xlsx');
const fs = require('fs');

const JWT_SECRET = process.env.JWT_SECRET;

// Register Admin
const registerAdmin = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ message: 'Admin already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newAdmin = new Admin({
      name,
      email,
      password: hashedPassword
    });

    await newAdmin.save();

    res.status(201).json({ message: 'Admin registered successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error during registration', error });
  }
};

// Login Admin
const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find admin
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign({ id: admin._id, email: admin.email }, JWT_SECRET, {
      expiresIn: '7d'
    });

    res.status(200).json({
      message: 'Login successful',
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during login', error });
  }
};

// 👤 Register Single Student
const registerStudent = async (req, res) => {
  try {
    const { name, regNo, email, batch, passoutYear } = req.body;

    // check for duplicate regNo
    const existing = await Student.findOne({ regNo });
    if (existing) return res.status(400).json({ message: 'Student already exists' });

    const hashedPassword = await bcrypt.hash(regNo, 10);

    const newStudent = new Student({
      name,
      regNo,
      email,
      password: hashedPassword,
      batch,
      passoutYear
    });

    await newStudent.save();
    res.status(201).json({ message: 'Student registered successfully' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
};
// 📥 Register Students in Bulk (Excel Upload)
const bulkRegisterStudents = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const { batch, passoutYear } = req.body;

    if (!batch || !passoutYear) {
      return res.status(400).json({ message: 'Batch and Passout Year are required in form-data' });
    }

    const filePath = req.file.path;
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const studentsData = XLSX.utils.sheet_to_json(sheet);

    const preparedStudents = await Promise.all(
      studentsData.map(async (student) => {
        if (!student.name || !student.regNo || !student.email) {
          throw new Error('Missing required fields (name, regNo, email) in Excel');
        }

        const hashedPassword = await bcrypt.hash(student.regNo.trim(), 10);
        return {
          name: student.name.trim(),
          regNo: student.regNo.trim(),
          email: student.email.trim(),
          batch: batch.trim(),
          passoutYear: passoutYear.trim(),
          password: hashedPassword
        };
      })
    );

    await Student.insertMany(preparedStudents);

    fs.unlinkSync(filePath);

    res.status(201).json({ message: 'Students registered successfully' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Bulk registration failed', error: err.message });
  }
};

// Get all students
const getAllStudents = async (req, res) => {
  try {
    const students = await Student.find({}, '-password');
    res.status(200).json({ students });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching students', error: error.message });
  }
};

// Add new training module
const addTrainingModule = async (req, res) => {
  try {
    const { title, description, durationDays, examsCount, studentIds } = req.body;
    
    // Validate studentIds
    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ message: 'Student IDs array is required' });
    }

    // Create new module
    const newModule = new Module({
      title,
      description,
      durationDays,
      examsCount
    });

    await newModule.save();

    // Update students with the new module
    const updateStudents = await Student.updateMany(
      { _id: { $in: studentIds } },
      { $push: { trainings: { moduleId: newModule._id } } }
    );

    if (updateStudents.modifiedCount === 0) {
      return res.status(400).json({ message: 'No students were updated' });
    }

    // Create training progress entries for each student
    const trainingProgressPromises = studentIds.map(studentId => {
      const progress = new TrainingProgress({
        student: studentId,
        training: newModule._id,
        attendance: [],
        examScores: Array(examsCount).fill().map((_, index) => ({
          exam: index + 1,
          score: 0
        })),
        averageScore: 0
      });
      return progress.save();
    });

    await Promise.all(trainingProgressPromises);

    res.status(201).json({ 
      message: 'Training module added and assigned to students successfully', 
      module: newModule,
      studentsAssigned: updateStudents.modifiedCount
    });
  } catch (error) {
    res.status(500).json({ message: 'Error adding training module', error: error.message });
  }
};

// Get all training modules
const getAllModules = async (req, res) => {
  try {
    const modules = await Module.find({});
    res.status(200).json({ modules });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching modules', error: error.message });
  }
};

// Update training module
const updateModule = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, durationDays, examsCount } = req.body;

    const updatedModule = await Module.findByIdAndUpdate(
      id,
      { title, description, durationDays, examsCount },
      { new: true }
    );

    if (!updatedModule) {
      return res.status(404).json({ message: 'Module not found' });
    }

    res.status(200).json({ message: 'Module updated successfully', module: updatedModule });
  } catch (error) {
    res.status(500).json({ message: 'Error updating module', error: error.message });
  }
};

// Get students by module ID
const getStudentsByModule = async (req, res) => {
  try {
    const { moduleId } = req.params;

    // Find all students who have this module in their trainings array
    const students = await Student.find(
      { 'trainings.moduleId': moduleId },
      '-password'
    ).populate({
      path: 'trainings.moduleId',
      select: 'title description durationDays examsCount'
    });

    if (!students || students.length === 0) {
      return res.status(404).json({ message: 'No students found for this module' });
    }

    // Get training progress for each student
    const studentsWithProgress = await Promise.all(
      students.map(async (student) => {
        const progress = await TrainingProgress.findOne({
          student: student._id,
          training: moduleId
        });

        return {
          ...student.toObject(),
          trainingProgress: progress || null
        };
      })
    );

    res.status(200).json({
      message: 'Students retrieved successfully',
      students: studentsWithProgress
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching students by module', error: error.message });
  }
};

module.exports = { 
  registerAdmin, 
  loginAdmin, 
  registerStudent,
  bulkRegisterStudents,
  getAllStudents,
  addTrainingModule,
  getAllModules,
  updateModule,
  getStudentsByModule
};
