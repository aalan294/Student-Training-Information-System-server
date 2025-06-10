const mongoose = require('mongoose');

const venueSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    capacity: { type: Number, required: true },
    status: { 
        type: String, 
        enum: ['unassigned', 'assigned'],
        default: 'unassigned'
    }
}, { timestamps: true });

module.exports = mongoose.model('Venue', venueSchema); 