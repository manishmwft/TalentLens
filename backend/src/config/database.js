import mongoose from 'mongoose';
import { env } from './env.js';

let connectionPromise = null;

export async function connectDatabase() {
  mongoose.set('strictQuery', true);

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(env.mongoUri).catch((error) => {
      connectionPromise = null;
      throw error;
    });
  }

  await connectionPromise;
  console.log(`MongoDB connected: ${mongoose.connection.host}`);
  return mongoose.connection;
}
