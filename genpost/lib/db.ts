import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

// Create a single global pool instance for Neon serverless Postgres
let pool: Pool;

if (process.env.NODE_ENV === "production") {
  pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL });
} else {
  // Prevent multiple pools from being created during hot-reloads in development
  if (!(global as any)._neonPool) {
    (global as any)._neonPool = new Pool({ connectionString: process.env.NEON_DATABASE_URL });
  }
  pool = (global as any)._neonPool;
}

export { pool };

// A convenient, typed query helper function
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<T[]> {
  const client = await pool.connect();
  try {
    const res = await client.query(text, params);
    return res.rows as T[];
  } finally {
    client.release();
  }
}
