import mongoose from 'mongoose';

declare global {
  var mongooseCache: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  } | undefined;
}

let cached = global.mongooseCache;

if (!cached) {
  cached = global.mongooseCache = { conn: null, promise: null };
}

async function dbConnect(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    const errorMsg = 'MONGODB_URI environment variable is not defined.';
    console.error(`[dbConnect Error]: ${errorMsg}`);
    throw new Error(errorMsg);
  }

  if (cached!.conn) {
    return cached!.conn;
  }

  if (!cached!.promise) {
    const opts: mongoose.ConnectOptions = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000, // Fail fast in 5s on serverless rather than default 30s
      connectTimeoutMS: 10000,
    };

    cached!.promise = mongoose.connect(uri, opts).then((mongooseInstance) => {
      return mongooseInstance;
    });
  }

  try {
    cached!.conn = await cached!.promise;
  } catch (e: unknown) {
    cached!.promise = null; // Clear rejected promise so subsequent requests can retry
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.error('[dbConnect Error] Failed to connect to MongoDB:', errorMsg);
    throw e;
  }

  return cached!.conn;
}

export default dbConnect;
