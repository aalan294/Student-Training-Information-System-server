const Student = require('../MODELS/studentSchema');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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

module.exports = {loginStudent}
