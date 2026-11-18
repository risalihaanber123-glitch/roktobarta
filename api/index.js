require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');

let app;

module.exports = async (req, res) => {
  try {
    if (mongoose.connection.readyState === 0) {
      await connectDB();
    }
    await mongoose.connection.asPromise();
  } catch (err) {
    console.error('DB connection failed:', err.message);
    return res.status(503).send('Database unavailable.');
  }
  if (!app) {
    app = require('../app');
  }
  return app(req, res);
};