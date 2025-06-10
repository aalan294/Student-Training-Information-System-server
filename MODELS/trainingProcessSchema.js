const mongoose = require('mongoose');

const trainingProgressSchema = new mongoose.Schema({
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    training: { type: mongoose.Schema.Types.ObjectId, ref: 'Module' },
    venueId: { type: mongoose.Schema.Types.ObjectId, ref: 'Venue', required: true },
    attendance: [{ date: Date, present: Boolean }],
    examScores: [{
      exam: { type: Number },
      score: Number
    }],
    averageScore: { type: Number, default: 0 }
  }, { timestamps: true });
  
  module.exports = mongoose.model('TrainingProgress', trainingProgressSchema);