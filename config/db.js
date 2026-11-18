const mongoose = require('mongoose');

const getMongoUri = () => {
  let uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/roktobarta';
  if (uri.includes('mongodb+srv://') || uri.startsWith('mongodb://')) {
    const basePart = uri.split('?')[0];
    const queryPart = uri.includes('?') ? '?' + uri.split('?')[1] : '?retryWrites=true&w=majority';
    if (basePart.endsWith('.net') || basePart.endsWith('.net/')) {
      const cleanBase = basePart.replace(/\/+$/, '');
      uri = ${cleanBase}/roktobarta;
    }
  }
  return uri;
};

const connectDB = async () => {
  const state = mongoose.connection.readyState;
  if (state === 1 || state === 2) return;
  try {
    const uri = getMongoUri();
    await mongoose.connect(uri);
    console.log('[MongoDB] Connected: ' + mongoose.connection.host + '/' + mongoose.connection.name);
  } catch (error) {
    console.error('[MongoDB Error] ' + error.message);
    throw error;
  }
};

module.exports = connectDB;
module.exports.getMongoUri = getMongoUri;