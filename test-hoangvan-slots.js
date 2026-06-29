const axios = require('axios');

async function testSlots() {
    try {
        console.log("Testing Hoang Van Login...");
        const loginRes = await axios.post("https://demobtctct.soatvetudong.vn/api/speedpos/login", {
            Username: "speedpos",
            Password: "SpeedHoangVan"
        }, {
            headers: { 'Content-Type': 'application/json' }
        });
        
        const token = loginRes.data.data.token;
        console.log("Got token");

        console.log("Testing get slots...");
        const dateStr = new Date().toISOString().split('T')[0];
        // Note: URL might be different based on HoangVanService.ts
        const slotsRes = await axios.get(`https://demobtctct.soatvetudong.vn/api/speedpos/slots?date=${dateStr}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        console.log("Status:", slotsRes.status);
        console.log("Data:", slotsRes.data);
    } catch (error) {
        console.error("Error Status:", error.response?.status);
        console.error("Error Data:", error.response?.data);
    }
}
testSlots();
