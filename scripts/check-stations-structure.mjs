/**
 * Check Stations Table Structure
 * This script queries the database to see the actual column names
 */

import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config({ path: ['.env.local', '.env'] })

const { Pool } = pg

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: process.env.POSTGRES_URL?.includes('supabase') ? { rejectUnauthorized: false } : false
})

async function checkTableStructure() {
    const client = await pool.connect()

    try {
        console.log('🔍 Checking stations table structure...\n')

        // Get table columns
        const columnsQuery = `
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = 'stations'
            ORDER BY ordinal_position
        `

        const columnsResult = await client.query(columnsQuery)

        if (columnsResult.rows.length > 0) {
            console.log('Columns in stations table:')
            columnsResult.rows.forEach(col => {
                console.log(`  • ${col.column_name} (${col.data_type}) - Nullable: ${col.is_nullable}`)
            })
        }

        console.log('\n📊 Sample station data:')
        const sampleQuery = 'SELECT * FROM stations LIMIT 1'
        const sampleResult = await client.query(sampleQuery)

        if (sampleResult.rows.length > 0) {
            console.log(JSON.stringify(sampleResult.rows[0], null, 2))
        }

    } catch (error) {
        console.error('❌ Error:', error.message)
    } finally {
        client.release()
        await pool.end()
    }
}

checkTableStructure()
