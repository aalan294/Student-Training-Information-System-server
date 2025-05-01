const mongoose = require('mongoose');

const trainingModule = new mongoose.Schema({
    title: String,
    description: String,
    durationDays: Number,
    examsCount: Number,
    createdAt: { type: Date, default: Date.now },
  });

module.exports = mongoose.model('Module',trainingModule);