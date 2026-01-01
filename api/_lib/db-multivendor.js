/**
 * Multi-Vendor Database Connection Utility
 * Supports both single-tenant (public schema) and multi-tenant (multivendor schema)
 * Handles local PostgreSQL (development) and Vercel/Supabase (production)
 */

let dbPool = null;

/**
 * Get database client with optional tenant context
 * @param {Object} options - Configuration options
 * @param {string} options.tenantCode - Tenant code for multi-vendor mode (optional)
 * @param {boolean} options.useMultiVendor - Whether to use multivendor schema (default: false)
 * @returns {Promise<Object>} Database client with release function and tenant info
 */
export async function getDbClient(options = {}) {
  const { tenantCode = null, useMultiVendor = false } = options;
  
  // Check if we're in Vercel environment
  const isVercel = process.env.VERCEL === '1' || process.env.VERCEL === 'true';

  if (isVercel) {
    // Determine which database to use based on Vercel environment
    const vercelEnv = process.env.VERCEL_ENV || 'development';

    console.log(`🔧 Vercel Environment: ${vercelEnv}`);

    let connectionString;

    if (vercelEnv === 'production') {
      connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
      console.log('📊 Using PRODUCTION database');
    } else {
      connectionString = process.env.TEST_POSTGRES_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL;

      if (process.env.TEST_POSTGRES_URL) {
        console.log('🧪 Using TEST database (preview/development)');
      } else {
        console.warn('⚠️  TEST_POSTGRES_URL not set - falling back to production database');
      }
    }

    if (!connectionString) {
      throw new Error('POSTGRES_URL or DATABASE_URL environment variable is required for Vercel deployment');
    }

    // Sanitize connection string
    connectionString = connectionString.trim().replace(/\s+/g, '').replace(/\n/g, '').replace(/\r/g, '');

    // Validate connection string format
    if (!connectionString.startsWith('postgresql://') && !connectionString.startsWith('postgres://')) {
      throw new Error('Invalid connection string format. Must start with postgresql:// or postgres://');
    }

    // Use connection pool for serverless
    const { Pool } = await import('pg');

    // Create pool if it doesn't exist or if it's been closed
    if (!dbPool || dbPool.ended) {
      try {
        const url = new URL(connectionString);
        url.searchParams.delete('sslmode');
        const modifiedConnectionString = url.toString();

        dbPool = new Pool({
          connectionString: modifiedConnectionString,
          ssl: {
            rejectUnauthorized: false
          },
          max: 1,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 30000
        });

        dbPool.on('error', (err) => {
          console.error('Unexpected error on idle client', err);
        });
      } catch (poolError) {
        dbPool = null;
        throw new Error(`Failed to create database connection pool: ${poolError.message}`);
      }
    }

    // Get a client from the pool with retry logic
    let client;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 2), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        client = await dbPool.connect();
        break;
      } catch (connectError) {
        if (attempt === maxRetries) {
          throw connectError;
        }
      }
    }

    if (!client) {
      throw new Error('Failed to establish database connection after all retry attempts');
    }

    // Set search path if using multi-vendor mode
    if (useMultiVendor) {
      await client.query('SET search_path TO multivendor, public');
    }

    // Get tenant info if tenant code provided
    let tenantInfo = null;
    if (useMultiVendor && tenantCode) {
      const result = await client.query(
        'SELECT id, tenant_code, shop_name, is_active FROM multivendor.tenants WHERE tenant_code = $1',
        [tenantCode]
      );
      
      if (result.rows.length === 0) {
        client.release();
        throw new Error(`Tenant not found: ${tenantCode}`);
      }
      
      if (!result.rows[0].is_active) {
        client.release();
        throw new Error(`Tenant is inactive: ${tenantCode}`);
      }
      
      tenantInfo = result.rows[0];
    }

    return {
      client,
      isVercel: true,
      useMultiVendor,
      tenantInfo,
      release: () => client.release()
    };
  } else {
    // Local development
    const { Pool } = await import('pg');

    const connectionString = process.env.POSTGRES_URL ||
      process.env.DATABASE_URL ||
      'postgresql://postgres:postgres@localhost:5432/gamersspot';

    // Create pool if it doesn't exist or if it's been closed
    if (!dbPool || dbPool.ended) {
      try {
        dbPool = new Pool({
          connectionString: connectionString,
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000,
          allowExitOnIdle: true,
        });

        dbPool.on('error', (err) => {
          console.error('Unexpected error on idle client', err);
        });

        console.log('Local database connection pool created');
      } catch (poolError) {
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

    // Set search path if using multi-vendor mode
    if (useMultiVendor) {
      await client.query('SET search_path TO multivendor, public');
    }

    // Get tenant info if tenant code provided
    let tenantInfo = null;
    if (useMultiVendor && tenantCode) {
      const result = await client.query(
        'SELECT id, tenant_code, shop_name, is_active FROM multivendor.tenants WHERE tenant_code = $1',
        [tenantCode]
      );
      
      if (result.rows.length === 0) {
        client.release();
        throw new Error(`Tenant not found: ${tenantCode}`);
      }
      
      if (!result.rows[0].is_active) {
        client.release();
        throw new Error(`Tenant is inactive: ${tenantCode}`);
      }
      
      tenantInfo = result.rows[0];
    }

    return {
      client,
      isVercel: false,
      useMultiVendor,
      tenantInfo,
      release: () => client.release()
    };
  }
}

export async function closeDbClient(db) {
  if (db && db.client) {
    try {
      if (db.release) {
        db.release();
      } else {
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
      console.log('Database pool closed');
      dbPool = null;
    }
  } catch (error) {
    console.error('Error closing database pool:', error);
  }
}

/**
 * Helper function to get tenant ID from tenant code
 * @param {Object} client - Database client
 * @param {string} tenantCode - Tenant code
 * @returns {Promise<number>} Tenant ID
 */
export async function getTenantId(client, tenantCode) {
  const result = await client.query(
    'SELECT id FROM multivendor.tenants WHERE tenant_code = $1 AND is_active = true',
    [tenantCode]
  );
  
  if (result.rows.length === 0) {
    throw new Error(`Active tenant not found: ${tenantCode}`);
  }
  
  return result.rows[0].id;
}
