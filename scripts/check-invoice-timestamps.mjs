/**
 * Check Invoice Timestamps
 * Verify the created_at timestamps for invoices
 */

import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config({ path: ['.env.local', '.env'] })

const { Pool } = pg

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: process.env.POSTGRES_URL?.includes('supabase') ? { rejectUnauthorized: false } : false
})

async function checkInvoices() {
    const client = await pool.connect()

    try {
        console.log('📊 Checking Invoice Timestamps:\n')

        const query = `
            SELECT 
                invoice_number,
                created_at,
                created_at AT TIME ZONE 'UTC' as created_at_utc,
                created_at AT TIME ZONE 'Asia/Kolkata' as created_at_ist,
                DATE(created_at AT TIME ZONE 'Asia/Kolkata') as date_ist,
                DATE(created_at AT TIME ZONE 'UTC') as date_utc,
                total,
                stations
            FROM invoices 
            ORDER BY created_at DESC
            LIMIT 5
        `

        const result = await client.query(query)

        result.rows.forEach(invoice => {
            console.log(`Invoice: ${invoice.invoice_number}`)
            console.log(`  Created At (raw): ${invoice.created_at}`)
            console.log(`  Created At (UTC): ${invoice.created_at_utc}`)
            console.log(`  Created At (IST): ${invoice.created_at_ist}`)
            console.log(`  Date (UTC): ${invoice.date_utc}`)
            console.log(`  Date (IST): ${invoice.date_ist}`)
            console.log(`  Total: ₹${invoice.total}`)

            // Parse stations to get customer name
            try {
                const stations = typeof invoice.stations === 'string'
                    ? JSON.parse(invoice.stations)
                    : invoice.stations
                if (Array.isArray(stations) && stations.length > 0) {
                    const customerName = stations[0].customerName || stations[0].customer_name || 'N/A'
                    console.log(`  Customer: ${customerName}`)
                }
            } catch (e) {
                console.log(`  Customer: Error parsing`)
            }
            console.log('')
        })

    } catch (error) {
        console.error('❌ Error:', error.message)
    } finally {
        client.release()
        await pool.end()
    }
}

checkInvoices()
