/**
 * Database connection utility
 * Supports both local PostgreSQL (development) and Vercel/Supabase (production)
 */

let dbClient = null;
let dbPool = null;

export async function getDbClient() {
  // Check if we're in Vercel environment
  // VERCEL env var is automatically set by Vercel
  const isVercel = process.env.VERCEL === '1' || process.env.VERCEL === 'true';

  if (isVercel) {
    // Determine which database to use based on Vercel environment
    // VERCEL_ENV can be: 'production', 'preview', or 'development'
    const vercelEnv = process.env.VERCEL_ENV || 'development';

    console.log(`🔧 Vercel Environment: ${vercelEnv}`);

    // Use Supabase connection string based on environment
    // For production: use POSTGRES_URL
    // For preview/development: use TEST_POSTGRES_URL (if available), fallback to POSTGRES_URL
    let connectionString;

    if (vercelEnv === 'production') {
      // Production environment - use production database
      connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
      console.log('📊 Using PRODUCTION database');
    } else {
      // Preview or development environment - use test database if available
      connectionString = process.env.TEST_POSTGRES_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL;

      if (process.env.TEST_POSTGRES_URL) {
        console.log('🧪 Using TEST database (preview/development)');
      } else {
        console.warn('⚠️  TEST_POSTGRES_URL not set - falling back to production database');
        console.warn('⚠️  Set TEST_POSTGRES_URL in Vercel for preview deployments');
      }
    }

    if (!connectionString) {
      console.error('POSTGRES_URL or DATABASE_URL environment variable is required for Vercel deployment');
      throw new Error('POSTGRES_URL or DATABASE_URL environment variable is required for Vercel deployment');
    }

    // Sanitize connection string: remove whitespace, newlines, and trim
    connectionString = connectionString.trim().replace(/\s+/g, '').replace(/\n/g, '').replace(/\r/g, '');

    // Validate connection string format
    if (!connectionString.startsWith('postgresql://') && !connectionString.startsWith('postgres://')) {
      console.error('Invalid connection string format. Must start with postgresql:// or postgres://');
      throw new Error('Invalid connection string format. Must start with postgresql:// or postgres://');
    }

    // Extract and validate hostname
    try {
      const url = new URL(connectionString);
      const hostname = url.hostname;

      // Check if hostname is complete (should contain pooler.supabase.com or db.xxx.supabase.co)
      if (!hostname || hostname.length < 10) {
        console.error('Connection string hostname appears to be truncated:', hostname);
        throw new Error(`Connection string hostname is incomplete: "${hostname}". Please check your POSTGRES_URL environment variable in Vercel - it may have been cut off or contain hidden characters.`);
      }

      if (!hostname.includes('supabase.com') && !hostname.includes('supabase.co')) {
        console.error('Connection string hostname does not appear to be a Supabase hostname:', hostname);
        throw new Error(`Connection string hostname "${hostname}" does not appear to be a valid Supabase hostname. Please verify your POSTGRES_URL in Vercel.`);
      }

      // Log connection string (without password) for debugging
      const connectionStringForLog = connectionString.replace(/:[^:@]+@/, ':****@');
      console.log('Attempting to connect with:', connectionStringForLog);
      console.log('Hostname:', hostname);
      console.log('Port:', url.port || '5432');
    } catch (urlError) {
      if (urlError.message.includes('incomplete') || urlError.message.includes('truncated')) {
        throw urlError;
      }
      console.error('Error parsing connection string URL:', urlError);
      throw new Error(`Invalid connection string format: ${urlError.message}. Please verify your POSTGRES_URL environment variable in Vercel.`);
    }

    // Check if using pooled connection (recommended for serverless)
    const isPooledConnection = connectionString.includes('pooler.supabase.com') || connectionString.includes(':6543');
    if (!isPooledConnection && connectionString.includes('db.') && connectionString.includes('.supabase.co')) {
      console.warn('WARNING: Using direct connection. Consider using pooled connection for better serverless performance.');
      console.warn('Get pooled connection string from Supabase Dashboard → Settings → Database → Connection pooling');
    }

    // Use connection pool for serverless (better for Vercel)
    const { Pool } = await import('pg');

    // Create pool if it doesn't exist or if it's been closed
    if (!dbPool || dbPool.ended) {
      try {
        // If pool exists but is ended, log it
        if (dbPool && dbPool.ended) {
          console.log('Pool was ended, recreating...');
        }

        // Parse connection string to modify SSL settings
        // Remove sslmode from connection string to avoid conflicts with Pool SSL config
        const url = new URL(connectionString);
        const originalSslMode = url.searchParams.get('sslmode');
        url.searchParams.delete('sslmode');
        const modifiedConnectionString = url.toString();

        console.log('Creating pool with SSL configuration');
        console.log('Original sslmode:', originalSslMode || 'not set');
        console.log('Using Pool SSL config: rejectUnauthorized=false');

        dbPool = new Pool({
          connectionString: modifiedConnectionString,
          // SSL configuration - explicitly set to allow self-signed certificates
          // This is required for Supabase
          ssl: {
            rejectUnauthorized: false // Required for Supabase self-signed certificates
          },
          max: 1, // Limit connections for serverless
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 30000 // Increased to 30 seconds for serverless cold starts and network delays
        });

        // Handle pool errors - if pool has an error, reset it
        dbPool.on('error', (err) => {
          console.error('Unexpected error on idle client', err);
          // Don't destroy the pool immediately, let retry logic handle it
        });
      } catch (poolError) {
        console.error('Error creating connection pool:', poolError);
        dbPool = null; // Reset pool on error
        throw new Error(`Failed to create database connection pool: ${poolError.message}. Please verify your POSTGRES_URL environment variable in Vercel.`);
      }
    }

    // Get a client from the pool with retry logic
    let client;
    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Attempting to get client from pool (attempt ${attempt}/${maxRetries})...`);

        // Add a small delay between retries (exponential backoff)
        if (attempt > 1) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 2), 5000); // 1s, 2s, 4s max
          console.log(`Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        client = await dbPool.connect();
        // Removed verbose success log - only log errors
        lastError = null;
        break; // Success, exit retry loop
      } catch (connectError) {
        lastError = connectError;
        // Only log connection errors on final attempt to reduce log spam
        // console.error(`Connection attempt ${attempt} failed:`, connectError.message);

        // Don't retry on certain errors
        if (connectError.code === 'ENOTFOUND') {
          throw new Error(
            `Cannot resolve database hostname. This usually means:\n` +
            `1. Your Supabase project might be paused - check Supabase Dashboard and restore if needed\n` +
            `2. The connection string hostname is incorrect - verify in Supabase Dashboard → Settings → Database\n` +
            `3. You should use the pooled connection string (pooler.supabase.com) instead of direct connection\n` +
            `Original error: ${connectError.message}`
          );
        }

        // If this is the last attempt, throw the error
        if (attempt === maxRetries) {
          console.error('❌ All database connection attempts failed');
          console.error('Connection error details:', {
            code: connectError.code,
            errno: connectError.errno,
            syscall: connectError.syscall,
            hostname: connectError.hostname || 'unknown',
            message: connectError.message
          });

          // Handle timeout errors with helpful message
          if (connectError.message && connectError.message.includes('timeout')) {
            throw new Error(
              `Database connection timeout after ${maxRetries} attempts. This usually means:\n` +
              `1. Your Supabase project might be paused - check Supabase Dashboard → Settings → General and restore if needed\n` +
              `2. Network connectivity issues - the pooler might be temporarily unavailable\n` +
              `3. Too many connections - try again in a few moments\n` +
              `4. Cold start delay - first connection after inactivity may take longer\n` +
              `\nTroubleshooting steps:\n` +
              `- Check Supabase Dashboard to ensure project is active\n` +
              `- Verify your connection string uses the Transaction Pooler (port 6543)\n` +
              `- Wait a few seconds and try again\n` +
              `Original error: ${connectError.message}`
            );
          }

          throw connectError;
        }

        // Continue to next retry attempt
        console.log(`Will retry connection (${maxRetries - attempt} attempts remaining)`);
      }
    }

    // If we get here without a client, something went wrong
    if (!client) {
      throw new Error('Failed to establish database connection after all retry attempts');
    }

    return {
      client,
      isVercel: true,
      release: () => client.release() // Return release function
    };
  } else {
    // Use local PostgreSQL connection pool for development
    // This prevents "too many clients" errors by reusing connections
    const { Pool } = await import('pg');

    // For local development, use POSTGRES_URL from .env.local
    // If not set, use default local connection
    const connectionString = process.env.POSTGRES_URL ||
      process.env.DATABASE_URL ||
      'postgresql://postgres:postgres@localhost:5432/gamersspot';

    // Create pool if it doesn't exist or if it's been closed
    if (!dbPool || dbPool.ended) {
      try {
        if (dbPool && dbPool.ended) {
          console.log('Local pool was ended, recreating...');
        }

        dbPool = new Pool({
          connectionString: connectionString,
          max: 20, // Increased from 10 to handle more concurrent requests
          idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
          connectionTimeoutMillis: 5000, // Increased timeout to 5 seconds
          allowExitOnIdle: true, // Allow pool to close when idle
        });

        // Handle pool errors
        dbPool.on('error', (err) => {
          console.error('Unexpected error on idle client', err);
        });

        console.log('Local database connection pool created');
      } catch (poolError) {
        console.error('Error creating local connection pool:', poolError);
        dbPool = null;
        throw new Error(`Failed to create database connection pool: ${poolError.message}`);
      }
    }

    // Get a client from the pool
    let client;
    try {
      client = await dbPool.connect();
    } catch (connectError) {
      console.error('Error getting client from pool:', connectError);
      throw connectError;
    }

    return {
      client,
      isVercel: false,
      release: () => client.release() // Release client back to pool
    };
  }
}

export async function closeDbClient(db) {
  if (db && db.client) {
    try {
      // Always release client back to pool (for both Vercel and local)
      if (db.release) {
        db.release();
      } else {
        // Fallback: close client if no release function (shouldn't happen with pool)
        await db.client.end();
      }
    } catch (error) {
      console.error('Error closing database connection:', error);
    }
  }
}

/**
 * Close all database connections and pools
 * Call this when shutting down the server
 */
export async function closeAllConnections() {
  try {
    if (dbPool && !dbPool.ended) {
      await dbPool.end();
      console.log('Local database pool closed');
      dbPool = null;
    }
  } catch (error) {
    console.error('Error closing database pool:', error);
  }
}

