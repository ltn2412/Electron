const axios = require('axios');

async function test(url, payload) {
  try {
    const res = await axios.post(url, payload);
    console.log(`[${url}] Login Success:`, res.data);
  } catch (error) {
    console.error(`[${url}] Login Error:`, error.response ? error.response.data : error.message);
  }
}

async function run() {
  const payloads = [
    { username: 'speedpos', password: 'SpeedHoangVan' },
    { Username: 'speedpos', Password: 'SpeedHoangVan' },
  ];
  
  const urls = [
    'https://demobtctct.soatvetudong.vn/api/speedpos/login',
    'https://demobtctct.soatvetudong.vn/api/login',
    'https://demobtctct.soatvetudong.vn/speedpos/login',
  ];

  for (const url of urls) {
    for (const payload of payloads) {
      console.log(`Testing ${url} with payload keys:`, Object.keys(payload));
      await test(url, payload);
    }
  }
}

run();
