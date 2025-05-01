const Admin = require('../MODELS/adminSchema');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Student = require('../MODELS/studentSchema');
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




// const bulkRegisterStudents = async (req, res) => {
//   try {
//     const filePath = req.file.path;

//     // Read and parse Excel
//     const workbook = XLSX.readFile(filePath);
//     const sheetName = workbook.SheetNames[0];
//     const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

//     // Expected columns: name, regNo, email, batch, passoutYear

//     const students = await Promise.all(data.map(async (student) => {
//       const hashedPassword = await bcrypt.hash(student.regNo.toString(), 10);
//       return {
//         ...student,
//         password: hashedPassword
//       };
//     }));

//     await Student.insertMany(students, { ordered: false }); 

//     fs.unlinkSync(filePath);

//     res.status(200).json({ message: 'Bulk student registration successful' });
//   } catch (err) {
//     res.status(500).json({ message: 'Error processing Excel file', error: err.message });
//   }
// };


module.exports = { registerAdmin, loginAdmin, registerStudent,bulkRegisterStudents };
