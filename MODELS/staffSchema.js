const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // Will be hashed
    status: { 
        type: String, 
        enum: ['unassigned', 'assigned'],
        default: 'unassigned'
    },
    venueId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Venue',
        default: null
    }
}, { timestamps: true });

module.exports = mongoose.model('Staff', staffSchema); 