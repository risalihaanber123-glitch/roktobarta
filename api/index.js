require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const app = require("../app");
let ready = false;
module.exports = async (req, res) => {
  if (!ready || mongoose.connection.readyState !== 1) {
    try { await connectDB(); ready = true; }
    catch(err) { res.status(503).send("DB unavailable"); return; }
  }
  return app(req, res);
};
