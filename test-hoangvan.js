const axios = require('axios');

async function testLogin() {
    try {
        console.log("Testing Hoang Van Login...");
        const res = await axios.post("https://demobtctct.soatvetudong.vn/api/speedpos/login", {
            Username: "speedpos",
            Password: "SpeedHoangVan"
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        console.log("Status:", res.status);
        console.log("Data:", res.data);
    } catch (error) {
        console.error("Error Status:", error.response?.status);
        console.error("Error Data:", error.response?.data);
    }
}
testLogin();
