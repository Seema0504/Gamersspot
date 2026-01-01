import dotenv from 'dotenv'
import pg from 'pg'
import readline from 'readline'

// Load environment variables
dotenv.config({ path: ['.env.local', '.env'] })

const { Pool } = pg

// Create readline interface for user confirmation
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

function askQuestion(query) {
    return new Promise(resolve => rl.question(query, resolve))
}

async function clearAllInvoices() {
    const pool = new Pool({
        connectionString: process.env.POSTGRES_URL,
    })

    try {
        // First, get count of invoices
        const countResult = await pool.query('SELECT COUNT(*) as count FROM invoices')
        const invoiceCount = parseInt(countResult.rows[0].count)

        console.log('\n⚠️  WARNING: This will delete ALL invoices from the database!')
        console.log(`📊 Current invoice count: ${invoiceCount}`)
        console.log('\n🔴 This action CANNOT be undone!\n')

        const answer = await askQuestion('Are you sure you want to delete all invoices? (yes/no): ')

        if (answer.toLowerCase() !== 'yes') {
            console.log('\n❌ Operation cancelled.')
            rl.close()
            await pool.end()
            return
        }

        console.log('\n🗑️  Deleting all invoices...')

        // Delete all invoices
        const result = await pool.query('DELETE FROM invoices')

        console.log(`\n✅ Successfully deleted ${result.rowCount} invoice(s)!`)
        console.log('\n📝 Note: Invoice numbers will continue from where they left off.')
        console.log('   The next invoice will use a new timestamp.\n')

    } catch (error) {
        console.error('\n❌ Error:', error.message)
        console.error(error)
    } finally {
        rl.close()
        await pool.end()
    }
}

clearAllInvoices()
