
const { getDbClient } = require('./api/db.js');
const jwt = require('jsonwebtoken');

async function testRenewal() {
    console.log('1. Checking Initial Status...');
    const db = await getDbClient();
    try {
        const initial = await db.client.query('SELECT status, end_date FROM subscriptions WHERE shop_id=3 ORDER BY created_at DESC LIMIT 1');
        console.log('Initial Status:', initial.rows[0]);

        const secret = process.env.JWT_SECRET || 'your-secret-key-change-this-in-prod';
        const token = jwt.sign({
            userId: 999,
            username: 'shop2',
            role: 'SHOP_OWNER',
            shopId: 3
        }, secret, { expiresIn: '1h' });

        console.log('3. Calling Renew API on 3002...');
        // Port 3002
        const response = await fetch('http://localhost:3002/api/subscription?action=renew', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ planId: 'MONTHLY' })
        });

        if (response.ok) {
            const data = await response.json();
            console.log('API Success:', data);
        } else {
            console.error('API Failed Status:', response.status);
            try { console.error('API Body:', await response.text()); } catch (e) { }
        }

        console.log('4. Checking Final Status...');
        const final = await db.client.query('SELECT status, end_date FROM subscriptions WHERE shop_id=3 ORDER BY created_at DESC LIMIT 1');
        console.log('Final Status:', final.rows[0]);

    } catch (e) {
        console.error('Verification Error:', e.message);
    } finally {
        await db.release();
        process.exit(0);
    }
}
testRenewal();
