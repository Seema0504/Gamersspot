import dotenv from 'dotenv'
import pg from 'pg'

// Load environment variables
dotenv.config({ path: ['.env.local', '.env'] })

const { Pool } = pg

async function checkInvoiceTimestamp() {
    const pool = new Pool({
        connectionString: process.env.POSTGRES_URL,
    })

    try {
        console.log('\n🔍 Checking invoice timestamp for INV-1767019887000...\n')

        // Get the raw timestamp
        const result = await pool.query(`
      SELECT 
        invoice_number,
        created_at as raw_utc,
        created_at AT TIME ZONE 'UTC' as explicit_utc,
        created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata' as ist_converted,
        to_char(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI:SS') as ist_formatted,
        to_char(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') as date_only
      FROM invoices
      WHERE invoice_number = $1
    `, ['INV-1767019887000'])

        if (result.rows.length === 0) {
            console.log('❌ Invoice not found!')
            return
        }

        const invoice = result.rows[0]
        console.log('Invoice Number:', invoice.invoice_number)
        console.log('\n📅 Timestamp Analysis:')
        console.log('─────────────────────────────────────────────────────')
        console.log('Raw UTC (from DB):', invoice.raw_utc)
        console.log('Explicit UTC:', invoice.explicit_utc)
        console.log('IST Converted:', invoice.ist_converted)
        console.log('IST Formatted:', invoice.ist_formatted)
        console.log('Date Only (IST):', invoice.date_only)
        console.log('─────────────────────────────────────────────────────')

        // Also check what JavaScript Date does with it
        const jsDate = new Date(invoice.ist_converted)
        console.log('\n🔧 JavaScript Date Handling:')
        console.log('─────────────────────────────────────────────────────')
        console.log('JS Date object:', jsDate)
        console.log('JS toISOString():', jsDate.toISOString())
        console.log('JS toLocaleString(IST):', jsDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }))
        console.log('JS toLocaleDateString(IST):', jsDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'long', day: 'numeric' }))
        console.log('─────────────────────────────────────────────────────')

    } catch (error) {
        console.error('❌ Error:', error.message)
        console.error(error)
    } finally {
        await pool.end()
    }
}

checkInvoiceTimestamp()
