const mongoose = require('mongoose');

const getMongoUri = () => {
  let uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/roktobarta';
  // If user provided a MongoDB Atlas cluster URL without specifying the database name,
  // automatically route to 'roktobarta' where all donors and records are stored.
  if (uri.includes('mongodb+srv://') || uri.startsWith('mongodb://')) {
    const basePart = uri.split('?')[0];
    const queryPart = uri.includes('?') ? '?' + uri.split('?')[1] : '?retryWrites=true&w=majority';
    if (basePart.endsWith('.net') || basePart.endsWith('.net/')) {
      const cleanBase = basePart.replace(/\/+$/, '');
      uri = `${cleanBase}/roktobarta${queryPart}`;
    }
  }
  return uri;
};

const connectDB = async () => {
  try {
    const uri = getMongoUri();
    const conn = await mongoose.connect(uri);
    console.log(`[MongoDB] Connected: ${conn.connection.host}/${conn.connection.name}`);
  } catch (error) {
    console.error(`[MongoDB Error] ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
module.exports.getMongoUri = getMongoUri;
