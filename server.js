// server.js or app.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const bodyParser = require('body-parser');
const multer = require('multer');
const xlsx = require('xlsx');


const app = express();

// Middleware setup
app.use(cors());
app.use(bodyParser.json()); 

// File upload setup using multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  },
});
const upload = multer({ storage: storage });

mongoose.connect(process.env.DB_URL)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.log('MongoDB connection error:', err));


app.listen(process.env.PORT || 5000, () => {
  console.log(`Server running on port ${process.env.PORT || 5000}`);
});

app.use('/admin',require('./ROUTER/adminRoute'));
