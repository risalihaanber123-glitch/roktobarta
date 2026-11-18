const session = require("express-session");
const MongoStore = require("connect-mongo");
const mongoose = require("mongoose");
const createSessionConfig = () => {
  const isProduction = process.env.NODE_ENV === "production";
  return session({
    name: "roktobarta_sid",
    secret: process.env.SESSION_SECRET || "roktobarta_default_fallback_session_secret_2026",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      clientPromise: mongoose.connection.asPromise().then(conn => conn.getClient()),
      collectionName: "sessions",
      ttl: 14 * 24 * 60 * 60,
      autoRemove: "native"
    }),
    cookie: { httpOnly: true, secure: isProduction, sameSite: "lax", maxAge: 14 * 24 * 60 * 60 * 1000 }
  });
};
module.exports = createSessionConfig;
