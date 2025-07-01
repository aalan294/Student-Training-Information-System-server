// remove26thAttendance.js
const mongoose = require('mongoose');
require('dotenv').config();

const TrainingProgress = require('./MODELS/trainingProcessSchema');

const MONGO_URI = process.env.DB_URL || 'mongodb://localhost:27017/YOUR_DB_NAME'; // update if needed
const TARGET_DATE = '2025-06-26'; // YYYY-MM-DD

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const dateStart = new Date(TARGET_DATE);
  const dateEnd = new Date(dateStart);
  dateEnd.setDate(dateEnd.getDate() + 1);

  // Find all progress records with attendance for the target date
  const progresses = await TrainingProgress.find({
    'attendance.date': { $gte: dateStart, $lt: dateEnd }
  });

  let updatedCount = 0;

  for (const progress of progresses) {
    const originalLength = progress.attendance.length;
    // Remove all attendance records for the target date
    progress.attendance = progress.attendance.filter(record => {
      const recordDate = record.date.toISOString().split('T')[0];
      return recordDate !== TARGET_DATE;
    });
    if (progress.attendance.length !== originalLength) {
      await progress.save();
      updatedCount++;
    }
  }

  console.log(`Removed attendance record for ${TARGET_DATE} from ${updatedCount} students.`);
  mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  mongoose.disconnect();
});