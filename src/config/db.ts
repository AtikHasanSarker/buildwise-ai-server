import mongoose from "mongoose";

const connectDB = async (): Promise<void> => {
  const conn = await mongoose.connect(process.env.MONGODB_URI as string);
  const dbName = conn.connection.db?.databaseName || "unknown";
  console.log(`MongoDB connected: host=${conn.connection.host}, database="${dbName}"`);
};

export default connectDB;
