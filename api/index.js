require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');

let app;
let dbReady = false;

module.exports = async (req, res) => {
  if (!dbReady || mongoose.connection.readyState !== 1) {
    try {
      await connectDB();
      dbReady = true;
    } catch (err) {
      console.error('DB connect failed:', err.message);
      return res.status(503).send('Database unavailable.');
    }
  }
  if (!app) {
    app = require('../app');
  }
  return app(req, res);
};