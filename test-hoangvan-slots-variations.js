const axios = require('axios');

async function testSlotsVariations() {
    try {
        const loginRes = await axios.post("https://demobtctct.soatvetudong.vn/api/speedpos/login", {
            Username: "speedpos",
            Password: "SpeedHoangVan"
        }, { headers: { 'Content-Type': 'application/json' } });
        const token = loginRes.data.data.token;

        const endpoints = [
            "https://demobtctct.soatvetudong.vn/api/speedpos/slots",
            "https://demobtctct.soatvetudong.vn/api/speedpos/slots?date=2026-06-29",
            "https://demobtctct.soatvetudong.vn/api/speedpos/slots?date=29/06/2026",
            "https://demobtctct.soatvetudong.vn/api/speedpos/getslots",
            "https://demobtctct.soatvetudong.vn/api/speedpos/Slots"
        ];

        for (const url of endpoints) {
            console.log(`\nTesting GET ${url}`);
            try {
                const res = await axios.get(url, { headers: { 'Authorization': `Bearer ${token}` } });
                console.log("Status:", res.status, "Data:", res.data);
            } catch (err) {
                console.log("Error Status:", err.response?.status, "Data:", err.response?.data);
            }
        }
        
    } catch (error) {
        console.error("Login failed:", error.message);
    }
}
testSlotsVariations();
