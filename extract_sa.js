const fs = require('fs');
const { execSync } = require('child_process');

const envContent = fs.readFileSync('.env.local', 'utf-8');

const testMatch = envContent.match(/FIREBASE_SERVICE_ACCOUNT_BASE64="([^"]+)"/);
const prodMatch = envContent.match(/PROD_FIREBASE_SERVICE_ACCOUNT_BASE64="([^"]+)"/);

if (!testMatch || !prodMatch) {
  console.error("Could not find service account base64 strings in .env.local");
  process.exit(1);
}

const testSaStr = Buffer.from(testMatch[1], 'base64').toString('utf-8');
const prodSaStr = Buffer.from(prodMatch[1], 'base64').toString('utf-8');

fs.writeFileSync('test-sa.json', testSaStr);
fs.writeFileSync('prod-sa.json', prodSaStr);

console.log("Service accounts extracted.");
