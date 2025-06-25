const Admin = require('../MODELS/adminSchema');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Student = require('../MODELS/studentSchema');
const Module = require('../MODELS/moduleSchema');
const TrainingProgress = require('../MODELS/trainingProcessSchema');
const Staff = require('../MODELS/staffSchema');
const Venue = require('../MODELS/venueSchema');
const XLSX = require('xlsx');
const fs = require('fs');
const mongoose = require('mongoose');
const { sendAbsenceEmail } = require('../services/emailService');

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
    const { name, regNo, email, batch, passoutYear,department } = req.body;

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
      passoutYear,
      department
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

    const { batch, passoutYear, department } = req.body;


    if (!batch || !passoutYear || !department) {
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
          department: department.trim(),
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

const bulkRegisterWithDetails = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const studentsData = XLSX.utils.sheet_to_json(sheet);

    const requiredColumns = ['name', 'regNo', 'email', 'department', 'batch', 'passoutYear'];
    const firstRow = studentsData[0] || {};
    const hasAllColumns = requiredColumns.every(col => Object.keys(firstRow).includes(col));

    if (!hasAllColumns) {
      fs.unlinkSync(filePath);
      return res.status(400).json({
        message: 'Excel file must contain columns: name, regNo, email, department, batch, passoutYear',
      });
    }

    const preparedStudents = await Promise.all(
      studentsData.map(async (student) => {
        const hashedPassword = await bcrypt.hash(String(student.regNo).trim(), 10);
        return {
          name: String(student.name).trim(),
          regNo: String(student.regNo).trim(),
          email: String(student.email).trim(),
          department: String(student.department).trim(),
          batch: String(student.batch).trim(),
          passoutYear: String(student.passoutYear).trim(),
          password: hashedPassword,
        };
      })
    );

    // Use a try-catch block to handle potential duplicate key errors
    try {
      await Student.insertMany(preparedStudents, { ordered: false });
    } catch (error) {
      if (error.code === 11000) {
        // This error code indicates a duplicate key error
        // Some students were duplicates, but others may have been inserted.
        // We can treat this as a partial success.
        console.log("Rejected duplicate entries:", error.writeErrors.map(e => e.err.op));
      } else {
        // Re-throw other errors
        throw error;
      }
    }


    fs.unlinkSync(filePath);

    res.status(201).json({ message: 'Students registered successfully. Some duplicates may have been skipped.' });

  } catch (err) {
    console.error(err);
    // Ensure file is deleted even if an error occurs
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ message: 'Bulk registration failed', error: err.message });
  }
};

// Get all students
const getAllStudents = async (req, res) => {
  try {
    const students = await Student.find({}, '-password');
    // Get all training progresses for all students
    const progresses = await TrainingProgress.find({})
      .select('student venueId training')
      .populate('venueId', 'name')
      .populate('training', 'title');
    // Map studentId to their venueIds (array of {venueId, venueName, trainingId, trainingTitle})
    const studentVenueMap = {};
    progresses.forEach(progress => {
      if (!studentVenueMap[progress.student]) studentVenueMap[progress.student] = [];
      studentVenueMap[progress.student].push({
        venueId: progress.venueId?._id?.toString() || null,
        venueName: progress.venueId?.name || null,
        trainingId: progress.training?._id?.toString() || null,
        trainingTitle: progress.training?.title || null
      });
    });
    // Attach venue info to each student
    const studentsWithVenues = students.map(student => {
      return {
        ...student.toObject(),
        venues: studentVenueMap[student._id] || []
      };
    });
    res.status(200).json({ students: studentsWithVenues });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching students', error: error.message });
  }
};

// Add new training module
const addTrainingModule = async (req, res) => {
  try {
    const { title, description, durationDays, examsCount, venueStudentMap } = req.body;
    
    // Validate venue-student mapping
    if (!venueStudentMap || typeof venueStudentMap !== 'object') {
      return res.status(400).json({ message: 'Venue-student mapping is required' });
    }

    // Validate all venues exist
    const venueIds = Object.keys(venueStudentMap);
    const venues = await Venue.find({ _id: { $in: venueIds } });
    if (venues.length !== venueIds.length) {
      return res.status(404).json({ message: 'One or more venues not found' });
    }

    // Create new module
    const newModule = new Module({
      title,
      description,
      durationDays,
      examsCount
    });

    await newModule.save();

    // Process each venue and its students
    const allStudentIds = [];
    const trainingProgressPromises = [];

    for (const [venueId, studentIds] of Object.entries(venueStudentMap)) {
      // Validate students exist
      const students = await Student.find({ _id: { $in: studentIds } });
      if (students.length !== studentIds.length) {
        return res.status(404).json({ message: 'One or more students not found' });
      }

      // Add students to the module
      await Student.updateMany(
        { _id: { $in: studentIds } },
        { $push: { trainings: { moduleId: newModule._id } } }
      );

      // Create training progress for each student with their assigned venue
      studentIds.forEach(studentId => {
        const progress = new TrainingProgress({
          student: studentId,
          training: newModule._id,
          venueId: venueId,
          attendance: [],
          examScores: Array(examsCount).fill().map((_, index) => ({
            exam: index + 1,
            score: 0
          })),
          averageScore: 0
        });
        trainingProgressPromises.push(progress.save());
        allStudentIds.push(studentId);
      });
    }

    await Promise.all(trainingProgressPromises);

    // Prepare venue details for response
    const venueDetails = venues.map(venue => ({
      id: venue._id,
      name: venue.name,
      capacity: venue.capacity,
      studentsAssigned: venueStudentMap[venue._id].length
    }));

    res.status(201).json({
      message: 'Training module created and assigned successfully',
      module: {
        id: newModule._id,
        title: newModule.title,
        venues: venueDetails,
        totalStudentsAssigned: allStudentIds.length
      }
    });

  } catch (error) {
    console.error('Error in addTrainingModule:', error);
    res.status(500).json({ message: 'Error creating training module', error: error.message });
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

// Bulk upload exam scores
const bulkUploadScores = async (req, res) => {
  try {
    const { moduleId, examNumber } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: 'No marks file uploaded' });
    }

    if (!moduleId || examNumber === undefined) {
      if (req.file) fs.unlinkSync(req.file.path); // Clean up file if validation fails
      return res.status(400).json({ message: 'Module ID and exam number are required' });
    }

    const filePath = req.file.path;
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const scoresData = XLSX.utils.sheet_to_json(sheet);

    // Validate required columns
    const requiredColumns = ['regNo', 'name', 'mark'];
    const hasAllColumns = requiredColumns.every(col => 
      Object.keys(scoresData[0] || {}).includes(col)
    );

    if (!hasAllColumns) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return res.status(400).json({ message: 'Excel file must contain regNo, name, and mark columns' });
    }

    try {
      // Process each student's score
      const updatePromises = scoresData.map(async (row) => {
        try {
          const student = await Student.findOne({ regNo: row.regNo.trim() });
          
          if (!student) {
            return null;
          }

          const progress = await TrainingProgress.findOne({
            student: student._id,
            training: moduleId
          });

          if (!progress) {
            return null;
          }

          // Find the exam score to update
          const examIndex = progress.examScores.findIndex(score => 
            Number(score.exam) === Number(examNumber)
          );

          if (examIndex === -1) {
            return null;
          }

          // Update the specific exam score
          progress.examScores[examIndex].score = Number(row.mark)*2;

          // Update average score
          const totalScore = progress.examScores.reduce((sum, exam) => sum + exam.score, 0);
          progress.averageScore = progress.examScores.length > 0 ? totalScore / progress.examScores.length : 0;

          // Save the updated progress
          const updatedProgress = await progress.save();
          return updatedProgress;
        } catch (error) {
          return null;
        }
      });

      const results = await Promise.all(updatePromises);
      const successfulUpdates = results.filter(result => result !== null);

      res.status(200).json({
        message: 'Scores uploaded successfully',
        totalRecords: scoresData.length,
        successfulUpdates: successfulUpdates.length,
        failedUpdates: scoresData.length - successfulUpdates.length,
        details: successfulUpdates.map(update => ({
          studentId: update.student,
          examScores: update.examScores
        }))
      });
    } catch (error) {
      throw error;
    } finally {
      // Always clean up the file after processing
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  } catch (error) {
    // Clean up file in case of error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ message: 'Error uploading scores', error: error.message });
  }
};

// Upload individual score
const uploadIndividualScore = async (req, res) => {
  try {
    const { studentId, moduleId, examNumber, score } = req.body;

    if (!studentId || !moduleId || examNumber === undefined || score === undefined) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Find the training progress
    const progress = await TrainingProgress.findOne({
      student: studentId,
      training: moduleId
    });

    if (!progress) {
      return res.status(404).json({ message: 'No training progress found' });
    }

    // Find the exam score to update - convert both to numbers for comparison
    const examIndex = progress.examScores.findIndex(score => 
      Number(score.exam) === Number(examNumber)
    );

    if (examIndex === -1) {
      return res.status(400).json({ message: 'Invalid exam number' });
    }

    // Update the specific exam score
    progress.examScores[examIndex].score = Number(score);

    // Update average score
    const totalScore = progress.examScores.reduce((sum, exam) => sum + exam.score, 0);
    progress.averageScore = progress.examScores.length > 0 ? totalScore / progress.examScores.length : 0;

    // Save the updated progress
    const updatedProgress = await progress.save();

    res.status(200).json({
      message: 'Score updated successfully',
      progress: {
        student: updatedProgress.student,
        training: updatedProgress.training,
        examScores: updatedProgress.examScores,
        averageScore: updatedProgress.averageScore
      }
    });
  } catch (error) {
    console.error('Error in uploadIndividualScore:', error);
    res.status(500).json({ message: 'Error updating score', error: error.message });
  }
};

// Delete student
const deleteStudent = async (req, res) => {
  try {
    const { studentId } = req.params;

    // Find and delete the student
    const student = await Student.findByIdAndDelete(studentId);
    
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Delete associated training progress
    await TrainingProgress.deleteMany({ student: studentId });

    res.status(200).json({ 
      message: 'Student deleted successfully',
      deletedStudent: {
        id: student._id,
        name: student.name,
        regNo: student.regNo,
        email: student.email
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting student', error: error.message });
  }
};

// Update attendance for multiple students
const updateAttendance = async (req, res) => {
  try {
    const { studentIds, moduleId, date, session, attendanceData } = req.body;
    // session: 'forenoon' or 'afternoon'
    // attendanceData: array of {studentId, present, od}

    if (!studentIds || !moduleId || !date || !session || !attendanceData) {
      return res.status(400).json({ 
        message: 'Missing required fields: studentIds, moduleId, date, session, and attendanceData are required' 
      });
    }

    if (!['forenoon', 'afternoon'].includes(session)) {
      return res.status(400).json({ 
        message: 'Invalid session. Must be either "forenoon" or "afternoon"' 
      });
    }

    // Validate date format
    const attendanceDate = new Date(date);
    if (isNaN(attendanceDate.getTime())) {
      return res.status(400).json({ message: 'Invalid date format' });
    }

    // Get all students enrolled in this module
    const allStudents = await Student.find({ 'trainings.moduleId': moduleId }, '_id');
    const allStudentIds = allStudents.map(s => s._id.toString());

    // Helper to upsert attendance
    const upsertAttendance = async (studentId, present, od = false) => {
      const progress = await TrainingProgress.findOne({ student: studentId, training: moduleId });
      if (!progress) return { studentId, status: 'failed', message: 'No training progress found' };
      
      const existingIndex = progress.attendance.findIndex(a => 
        a.date.toISOString().split('T')[0] === attendanceDate.toISOString().split('T')[0]
      );

      if (existingIndex !== -1) {
        // Update existing attendance record
        progress.attendance[existingIndex][session] = {
          present,
          od
        };
      } else {
        // Create new attendance record
        const newAttendance = {
          date: attendanceDate,
          forenoon: { present: false, od: false },
          afternoon: { present: false, od: false }
        };
        newAttendance[session] = {
          present,
          od
        };
        progress.attendance.push(newAttendance);
      }
      
      await progress.save();
      return { studentId, status: 'success', present, od };
    };

    // Update attendance for all students
    const updatePromises = allStudentIds.map(async (studentId) => {
      const studentAttendance = attendanceData.find(a => a.studentId === studentId);
      if (studentAttendance) {
        return await upsertAttendance(studentId, studentAttendance.present, studentAttendance.od || false);
      } else {
        // If student not in attendanceData, mark as absent
        return await upsertAttendance(studentId, false, false);
      }
    });

    const results = await Promise.all(updatePromises);
    const successfulUpdates = results.filter(r => r.status === 'success');

    res.status(200).json({
      message: `${session} attendance update completed`,
      totalStudents: allStudentIds.length,
      successfulUpdates: successfulUpdates.length,
      failedUpdates: allStudentIds.length - successfulUpdates.length,
      session,
      date: attendanceDate.toISOString().split('T')[0],
      details: results
    });
  } catch (error) {
    console.error('Error updating attendance:', error);
    res.status(500).json({ 
      message: 'Error updating attendance', 
      error: error.message 
    });
  }
};

// Update module details
const updateModuleDetails = async (req, res) => {
  try {
    const { moduleId } = req.params;
    const { title, description, durationDays, examsCount, isCompleted } = req.body;

    // Validate required fields
    if (!title || !description || !durationDays || !examsCount) {
      return res.status(400).json({ 
        message: 'Missing required fields: title, description, durationDays, and examsCount are required' 
      });
    }

    // Find and update the module
    const updatedModule = await Module.findByIdAndUpdate(
      moduleId,
      {
        title,
        description,
        durationDays,
        examsCount,
        isCompleted: isCompleted || false
      },
      { new: true, runValidators: true }
    );

    if (!updatedModule) {
      return res.status(404).json({ message: 'Module not found' });
    }

    res.status(200).json({
      message: 'Module updated successfully',
      module: updatedModule
    });

  } catch (error) {
    console.error('Error updating module:', error);
    res.status(500).json({ 
      message: 'Error updating module', 
      error: error.message 
    });
  }
};

// Mark module as completed
const markModuleAsCompleted = async (req, res) => {
  try {
    const { moduleId } = req.params;

    // Find and update the module
    const module = await Module.findById(moduleId);
    if (!module) {
      return res.status(404).json({ message: 'Module not found' });
    }

    // Update module status
    module.isCompleted = true;
    await module.save();

    // Find all students enrolled in this module
    const students = await Student.find({ 'trainings.moduleId': moduleId });

    // Update completed trainings count for each student
    const updatePromises = students.map(async (student) => {
      student.numTrainingsCompleted += 1;
      return student.save();
    });

    await Promise.all(updatePromises);

    res.status(200).json({
      message: 'Module marked as completed successfully',
      module: {
        _id: module._id,
        title: module.title,
        isCompleted: module.isCompleted
      },
      studentsUpdated: students.length
    });

  } catch (error) {
    res.status(500).json({ 
      message: 'Error marking module as completed', 
      error: error.message 
    });
  }
};

// Update students batch
const updateStudentsBatch = async (req, res) => {
  try {
    const { studentIds, newBatch } = req.body;

    // Validate input
    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({
        message: 'Invalid input',
        error: 'studentIds must be a non-empty array'
      });
    }

    if (!newBatch || typeof newBatch !== 'string') {
      return res.status(400).json({
        message: 'Invalid input',
        error: 'newBatch must be a string'
      });
    }

    // Validate all student IDs
    const invalidIds = studentIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({
        message: 'Invalid student IDs',
        error: 'Some student IDs are not valid MongoDB ObjectIds',
        invalidIds
      });
    }

    // Update all students
    const result = await Student.updateMany(
      { _id: { $in: studentIds } },
      { $set: { batch: newBatch } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        message: 'No students found',
        error: 'None of the provided student IDs exist in the database'
      });
    }

    res.status(200).json({
      message: 'Batch updated successfully',
      updatedCount: result.modifiedCount,
      totalMatched: result.matchedCount
    });

  } catch (error) {
    res.status(500).json({
      message: 'Error updating student batches',
      error: error.message
    });
  }
};

// Register Staff
const registerStaff = async (req, res) => {
  try {
    const { name, email } = req.body;

    // Check if staff already exists
    const existingStaff = await Staff.findOne({ email });
    if (existingStaff) {
      return res.status(400).json({ message: 'Staff with this email already exists' });
    }

    // Hash the email to use as password
    const hashedPassword = await bcrypt.hash(email, 10);

    const newStaff = new Staff({
      name,
      email,
      password: hashedPassword,
      status: 'unassigned',
      venueId: null
    });

    await newStaff.save();

    res.status(201).json({ 
      message: 'Staff registered successfully',
      staff: {
        name: newStaff.name,
        email: newStaff.email,
        status: newStaff.status,
        venueId: newStaff.venueId
      }
    });
  } catch (error) {
    console.error('Staff registration error:', error);
    res.status(500).json({ message: 'Server error during staff registration', error: error.message });
  }
};

// Register Venue
const registerVenue = async (req, res) => {
  try {
    const { name, capacity, status } = req.body;

    // Validate input
    if (!name || !capacity) {
      return res.status(400).json({ message: 'Name and capacity are required' });
    }

    // Validate status if provided
    if (status && !['unassigned', 'assigned'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value. Must be either "unassigned" or "assigned"' });
    }

    // Check if venue already exists
    const existingVenue = await Venue.findOne({ name });
    if (existingVenue) {
      return res.status(400).json({ message: 'Venue with this name already exists' });
    }

    // Create new venue
    const newVenue = new Venue({
      name,
      capacity,
      status: status || 'unassigned' // Use provided status or default to 'unassigned'
    });

    await newVenue.save();

    res.status(201).json({
      message: 'Venue registered successfully',
      venue: {
        id: newVenue._id,
        name: newVenue.name,
        capacity: newVenue.capacity,
        status: newVenue.status
      }
    });
  } catch (error) {
    console.error('Venue registration error:', error);
    res.status(500).json({ message: 'Server error during venue registration', error: error.message });
  }
};

// Get All Venues
const getAllVenues = async (req, res) => {
  try {
    const venues = await Venue.find({});
    res.status(200).json({ venues });
  } catch (error) {
    console.error('Error fetching venues:', error);
    res.status(500).json({ message: 'Error fetching venues', error: error.message });
  }
};

// Assign Staff to Venue
const assignStaffToVenue = async (req, res) => {
  try {
    const { staffId, venueId } = req.body;

    // Validate input
    if (!staffId || !venueId) {
      return res.status(400).json({ message: 'Staff ID and Venue ID are required' });
    }

    // Check if staff exists and is unassigned
    const staff = await Staff.findById(staffId);
    if (!staff) {
      return res.status(404).json({ message: 'Staff not found' });
    }
    if (staff.status === 'assigned') {
      return res.status(400).json({ message: 'Staff is already assigned to a venue' });
    }

    // Check if venue exists and is unassigned
    const venue = await Venue.findById(venueId);
    if (!venue) {
      return res.status(404).json({ message: 'Venue not found' });
    }
    if (venue.status === 'assigned') {
      return res.status(400).json({ message: 'Venue is already assigned to a staff' });
    }

    // Update staff with venue and status
    staff.venueId = venueId;
    staff.status = 'assigned';
    await staff.save();

    // Update venue status
    venue.status = 'assigned';
    await venue.save();

    res.status(200).json({
      message: 'Staff assigned to venue successfully',
      assignment: {
        staff: {
          id: staff._id,
          name: staff.name,
          email: staff.email,
          status: staff.status
        },
        venue: {
          id: venue._id,
          name: venue.name,
          capacity: venue.capacity,
          status: venue.status
        }
      }
    });
  } catch (error) {
    console.error('Staff assignment error:', error);
    res.status(500).json({ message: 'Server error during staff assignment', error: error.message });
  }
};

// Get All Staff Details
const getAllStaff = async (req, res) => {
  try {
    const staff = await Staff.find({})
      .populate('venueId', 'name capacity status')
      .select('-password'); // Exclude password from response

    // Format the response
    const formattedStaff = staff.map(staffMember => ({
      id: staffMember._id,
      name: staffMember.name,
      email: staffMember.email,
      status: staffMember.status,
      venue: staffMember.venueId ? {
        id: staffMember.venueId._id,
        name: staffMember.venueId.name,
        capacity: staffMember.venueId.capacity,
        status: staffMember.venueId.status
      } : null
    }));

    res.status(200).json({
      message: 'Staff details retrieved successfully',
      staff: formattedStaff
    });
  } catch (error) {
    console.error('Error fetching staff:', error);
    res.status(500).json({ message: 'Error fetching staff details', error: error.message });
  }
};

// Unassign Staff from Venue
const unassignStaffFromVenue = async (req, res) => {
  try {
    const { staffId } = req.body;

    // Validate input
    if (!staffId) {
      return res.status(400).json({ message: 'Staff ID is required' });
    }

    // Check if staff exists and is assigned
    const staff = await Staff.findById(staffId);
    if (!staff) {
      return res.status(404).json({ message: 'Staff not found' });
    }
    if (staff.status !== 'assigned' || !staff.venueId) {
      return res.status(400).json({ message: 'Staff is not assigned to any venue' });
    }

    // Get the venue
    const venue = await Venue.findById(staff.venueId);
    if (!venue) {
      return res.status(404).json({ message: 'Associated venue not found' });
    }

    // Update staff
    staff.venueId = null;
    staff.status = 'unassigned';
    await staff.save();

    // Update venue
    venue.status = 'unassigned';
    await venue.save();

    res.status(200).json({
      message: 'Staff unassigned from venue successfully',
      unassignment: {
        staff: {
          id: staff._id,
          name: staff.name,
          email: staff.email,
          status: staff.status
        },
        venue: {
          id: venue._id,
          name: venue.name,
          capacity: venue.capacity,
          status: venue.status
        }
      }
    });
  } catch (error) {
    console.error('Staff unassignment error:', error);
    res.status(500).json({ message: 'Server error during staff unassignment', error: error.message });
  }
};

// Emergency Unassign All Staff and Venues
const emergencyUnassignAll = async (req, res) => {
  try {
    // Get all assigned staff
    const assignedStaff = await Staff.find({ status: 'assigned' });
    
    // Get all assigned venues
    const assignedVenues = await Venue.find({ status: 'assigned' });

    // Update all assigned staff
    const staffUpdatePromises = assignedStaff.map(staff => {
      staff.venueId = null;
      staff.status = 'unassigned';
      return staff.save();
    });

    // Update all assigned venues
    const venueUpdatePromises = assignedVenues.map(venue => {
      venue.status = 'unassigned';
      return venue.save();
    });

    // Wait for all updates to complete
    await Promise.all([...staffUpdatePromises, ...venueUpdatePromises]);

    res.status(200).json({
      message: 'Emergency unassignment completed successfully',
      summary: {
        staffUnassigned: assignedStaff.length,
        venuesUnassigned: assignedVenues.length,
        details: {
          staff: assignedStaff.map(staff => ({
            id: staff._id,
            name: staff.name,
            email: staff.email
          })),
          venues: assignedVenues.map(venue => ({
            id: venue._id,
            name: venue.name,
            capacity: venue.capacity
          }))
        }
      }
    });
  } catch (error) {
    console.error('Emergency unassignment error:', error);
    res.status(500).json({ 
      message: 'Server error during emergency unassignment', 
      error: error.message 
    });
  }
};

// Get Attendance History for All Venues
const getAllVenuesAttendanceHistory = async (req, res) => {
  try {
    // Get all venues
    const venues = await Venue.find({});
    // For each venue, get all progresses and attendance grouped by date
    const venueAttendance = await Promise.all(venues.map(async (venue) => {
      const progresses = await TrainingProgress.find({ venueId: venue._id })
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
      // Convert to array and sort by date
      const attendanceHistory = Object.values(attendanceByDate)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      return {
        venue: {
          id: venue._id,
          name: venue.name,
          capacity: venue.capacity
        },
        attendanceHistory
      };
    }));
    res.status(200).json({ venueAttendance });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching all venues attendance history', error: error.message });
  }
};

const markAttendanceByAdmin = async (req, res) => {
  try {
    const { date, session, attendanceData } = req.body; // attendanceData: array of {studentId, venueId, present, od}
    
    const attendanceDate = new Date(date);
    if (isNaN(attendanceDate.getTime())) {
      return res.status(400).json({ message: 'Invalid date format' });
    }

    if (!['forenoon', 'afternoon'].includes(session)) {
      return res.status(400).json({ 
        message: 'Invalid session. Must be either "forenoon" or "afternoon"' 
      });
    }

    const updatePromises = attendanceData.map(async (studentAttendance) => {
      const { studentId, venueId, present, od } = studentAttendance;

      if (!studentId || !venueId) {
        return { studentId, status: 'skipped', reason: 'Missing studentId or venueId' };
      }

      const progress = await TrainingProgress.findOne({ student: studentId, venueId }).populate('student', 'email');
      if (!progress) {
        return { studentId, status: 'skipped', reason: 'Training progress not found' };
      }

      const existingIndex = progress.attendance.findIndex(a => 
        a.date.toISOString().split('T')[0] === attendanceDate.toISOString().split('T')[0]
      );

      let wasPreviouslyAbsent = false;
      let emailAlreadySent = false;

      if (existingIndex !== -1) {
        // Update existing attendance record - preserve other session data
        const existingRecord = progress.attendance[existingIndex];
        
        // Check if student was previously absent and if email was already sent
        wasPreviouslyAbsent = !existingRecord[session]?.present && !existingRecord[session]?.od;
        emailAlreadySent = existingRecord[session]?.emailSent || false;
        
        existingRecord[session] = { 
          present, 
          od: od || false,
          emailSent: existingRecord[session]?.emailSent || false // Preserve email sent status
        };
        
        // Keep the other session data intact
        if (!existingRecord.forenoon) existingRecord.forenoon = { present: false, od: false, emailSent: false };
        if (!existingRecord.afternoon) existingRecord.afternoon = { present: false, od: false, emailSent: false };
      } else {
        // Create new attendance record with default values for both sessions
        const newAttendance = {
          date: attendanceDate,
          forenoon: { present: false, od: false, emailSent: false },
          afternoon: { present: false, od: false, emailSent: false }
        };
        newAttendance[session] = { present, od: od || false, emailSent: false };
        progress.attendance.push(newAttendance);
      }
      
      await progress.save();

      // Determine if email should be sent
      const isCurrentlyAbsent = !present && !od;
      const shouldSendEmail = isCurrentlyAbsent && !wasPreviouslyAbsent && !emailAlreadySent;

      // Mark email as sent if we're going to send it
      if (shouldSendEmail) {
        if (existingIndex !== -1) {
          progress.attendance[existingIndex][session].emailSent = true;
          await progress.save();
        } else {
          // For new records, update the emailSent flag
          const newIndex = progress.attendance.length - 1;
          progress.attendance[newIndex][session].emailSent = true;
          await progress.save();
        }
      }

      return { 
        student: progress.student, 
        status: 'success',
        present: present,
        od: od || false,
        shouldSendEmail,
        wasPreviouslyAbsent,
        emailAlreadySent
      };
    });

    const results = await Promise.all(updatePromises);

    // Filter out students who should receive absence emails (only newly absent students)
    const newlyAbsentStudentEmails = results
      .filter(result => result.status === 'success' && result.shouldSendEmail)
      .map(result => result.student.email);
    
    if (newlyAbsentStudentEmails.length > 0) {
      sendAbsenceEmail(newlyAbsentStudentEmails, date, session);
    }

    const successfulUpdates = results.filter(r => r.status === 'success');
    const skippedUpdates = results.filter(r => r.status === 'skipped');
    const newlyAbsentCount = newlyAbsentStudentEmails.length;

    res.status(200).json({ 
      message: `${session} attendance updated successfully by admin`,
      results,
      summary: {
        successful: successfulUpdates.length,
        skipped: skippedUpdates.length,
        total: attendanceData.length,
        newlyAbsentStudents: newlyAbsentCount,
        emailsSent: newlyAbsentCount
      },
      session,
      date: attendanceDate.toISOString().split('T')[0]
    });
  } catch (error) {
    console.error('Error marking attendance by admin:', error);
    res.status(500).json({ message: 'Error marking attendance by admin', error: error.message });
  }
};

// Get existing attendance data for admin
const getExistingAttendance = async (req, res) => {
  try {
    const { date, session } = req.query;
    
    if (!date || !session) {
      return res.status(400).json({ 
        message: 'Missing required parameters: date and session are required' 
      });
    }

    if (!['forenoon', 'afternoon'].includes(session)) {
      return res.status(400).json({ 
        message: 'Invalid session. Must be either "forenoon" or "afternoon"' 
      });
    }

    const attendanceDate = new Date(date);
    if (isNaN(attendanceDate.getTime())) {
      return res.status(400).json({ message: 'Invalid date format' });
    }

    // Get all training progresses with attendance data for the specified date
    const progresses = await TrainingProgress.find({
      'attendance.date': {
        $gte: new Date(attendanceDate.getFullYear(), attendanceDate.getMonth(), attendanceDate.getDate()),
        $lt: new Date(attendanceDate.getFullYear(), attendanceDate.getMonth(), attendanceDate.getDate() + 1)
      }
    }).populate('student', 'name regNo email batch department venues')
      .populate('venueId', 'name');

    const attendanceData = {};
    
    progresses.forEach(progress => {
      const attendanceRecord = progress.attendance.find(a => 
        a.date.toISOString().split('T')[0] === attendanceDate.toISOString().split('T')[0]
      );

      if (attendanceRecord && attendanceRecord[session]) {
        attendanceData[progress.student._id] = {
          studentId: progress.student._id,
          venueId: progress.venueId?._id,
          venueName: progress.venueId?.name,
          present: attendanceRecord[session].present,
          od: attendanceRecord[session].od || false,
          emailSent: attendanceRecord[session].emailSent || false,
          student: {
            name: progress.student.name,
            regNo: progress.student.regNo,
            email: progress.student.email,
            batch: progress.student.batch,
            department: progress.student.department
          }
        };
      }
    });

    res.status(200).json({
      date: attendanceDate.toISOString().split('T')[0],
      session,
      attendanceData,
      totalRecords: Object.keys(attendanceData).length
    });

  } catch (error) {
    console.error('Error fetching existing attendance:', error);
    res.status(500).json({ 
      message: 'Error fetching existing attendance', 
      error: error.message 
    });
  }
};

module.exports = { 
  registerAdmin, 
  loginAdmin, 
  registerStudent,
  bulkRegisterStudents,
  bulkRegisterWithDetails,
  getAllStudents,
  addTrainingModule,
  getAllModules,
  updateModule,
  getStudentsByModule,
  bulkUploadScores,
  uploadIndividualScore,
  deleteStudent,
  updateAttendance,
  updateModuleDetails,
  markModuleAsCompleted,
  updateStudentsBatch,
  registerStaff,
  registerVenue,
  getAllVenues,
  assignStaffToVenue,
  getAllStaff,
  unassignStaffFromVenue,
  emergencyUnassignAll,
  getAllVenuesAttendanceHistory,
  markAttendanceByAdmin,
  getExistingAttendance
};
