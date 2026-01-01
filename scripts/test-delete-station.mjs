/**
 * Test DELETE Station API Endpoint
 * This script tests if the DELETE endpoint is working correctly
 */

async function testDeleteStation(stationId) {
    try {
        console.log(`🧪 Testing DELETE for station ID: ${stationId}\n`);

        const response = await fetch(`http://localhost:3001/api/stations?id=${stationId}`, {
            method: 'DELETE',
        });

        console.log(`📡 Response Status: ${response.status} ${response.statusText}`);

        const data = await response.json();
        console.log(`📦 Response Data:`, JSON.stringify(data, null, 2));

        if (response.ok) {
            console.log(`\n✅ DELETE request successful!`);
        } else {
            console.log(`\n❌ DELETE request failed!`);
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// Test deleting station ID 10
testDeleteStation(10);
