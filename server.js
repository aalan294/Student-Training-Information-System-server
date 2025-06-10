// server.js or app.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const bodyParser = require('body-parser');
const staffRoute = require('./ROUTER/staffRoute');


const app = express();

// Middleware setup
app.use(cors());
app.use(bodyParser.json()); 


mongoose.connect(process.env.DB_URL)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.log('MongoDB connection error:', err));


app.listen(process.env.PORT || 5000, () => {
  console.log(`Server running on port ${process.env.PORT || 5000}`);
});

app.use('/admin',require('./ROUTER/adminRoute'));
app.use('/student',require('./ROUTER/studentRoute'))
app.use('/staff', staffRoute);
