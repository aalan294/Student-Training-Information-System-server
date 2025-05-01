const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  name: String,
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true } // Hashed
}, { timestamps: true });

module.exports = mongoose.model('Admin', adminSchema);
