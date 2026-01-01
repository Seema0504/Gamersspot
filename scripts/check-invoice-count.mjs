import dotenv from 'dotenv'
import pg from 'pg'

// Load environment variables
dotenv.config({ path: ['.env.local', '.env'] })

const { Pool } = pg

async function checkInvoices() {
    const pool = new Pool({
        connectionString: process.env.POSTGRES_URL,
    })

    try {
        const result = await pool.query('SELECT COUNT(*) as count FROM invoices')
        const count = parseInt(result.rows[0].count)

        console.log(`\n📊 Current invoice count: ${count}`)

        if (count === 0) {
            console.log('✅ All invoices have been deleted!\n')
        } else {
            console.log(`\n📋 Remaining invoices:`)
            const invoices = await pool.query('SELECT invoice_number, created_at FROM invoices ORDER BY created_at DESC LIMIT 10')
            invoices.rows.forEach(inv => {
                console.log(`  - ${inv.invoice_number} (${inv.created_at})`)
            })
            console.log()
        }

    } catch (error) {
        console.error('❌ Error:', error.message)
    } finally {
        await pool.end()
    }
}

checkInvoices()
