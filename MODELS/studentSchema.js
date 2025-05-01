const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
    name: String,
    regNo: { type: String, unique: true, required: true },
    email: { type: String, required: true },
    password: { type: String, required: true },
    batch: { type: String, enum: ['Service', 'Dream', 'Super Dream', 'Marquee'], required: true },
    passoutYear: { type: Number, required: true },
    numTrainingsCompleted: { type: Number, default: 0 },
    trainings: [
      {
        moduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Module' }
      }
    ],
    leetcodeId: String,
    codechefId: String,
  });

  module.exports = mongoose.model('Student',studentSchema);