require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');

let app;
let _connectionPromise = null;

// Use a shared promise so concurrent cold-start requests
// all wait for the SAME connection attempt instead of racing.
const ensureConnected = () => {
  if (mongoose.connection.readyState === 1) return Promise.resolve();
  if (!_connectionPromise) {
    _connectionPromise = connectDB()
      .then(() => { _connectionPromise = null; })
      .catch(err => { _connectionPromise = null; throw err; });
  }
  return _connectionPromise;
};

module.exports = async (req, res) => {
  try {
    await ensureConnected();
  } catch (err) {
    console.error('DB connect failed:', err.message);
    return res.status(503).send('Database unavailable.');
  }
  if (!app) {
    app = require('../app');
  }
  return app(req, res);
};
