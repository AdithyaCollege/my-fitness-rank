const https = require('https');
const fs = require('fs');
const path = require('path');

const url = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
const dest = path.join(__dirname, '..', 'src', 'lib', 'exercises.json');

console.log('Downloading exercises from yuhonas/free-exercise-db...');
console.log('Target path:', dest);

https.get(url, (res) => {
  if (res.statusCode !== 200) {
    console.error(`Request Failed. Status Code: ${res.statusCode}`);
    res.resume();
    process.exit(1);
  }

  let rawData = '';
  res.on('data', (chunk) => { rawData += chunk; });
  res.on('end', () => {
    try {
      // Validate that it's valid JSON
      const parsedData = JSON.parse(rawData);
      console.log(`Successfully downloaded ${parsedData.length} exercises.`);
      
      // Ensure target directory exists
      const dir = path.dirname(dest);
      if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(dest, JSON.stringify(parsedData, null, 2));
      console.log('Exercises saved successfully!');
    } catch (e) {
      console.error('Error parsing JSON data:', e.message);
      process.exit(1);
    }
  });
}).on('error', (e) => {
  console.error(`Got error: ${e.message}`);
  process.exit(1);
});
