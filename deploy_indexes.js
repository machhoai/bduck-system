const fs = require('fs');
const { execSync } = require('child_process');

const envContent = fs.readFileSync('.env.local', 'utf-8');

// Find TEST SA
const testMatch = envContent.match(/FIREBASE_SERVICE_ACCOUNT_BASE64="([^"]+)"/);
// Find PROD SA
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

try {
  console.log("Fetching indexes from test-jw-system...");
  execSync('npx firebase firestore:indexes --project test-jw-system > firestore.indexes.json', {
    env: { ...process.env, GOOGLE_APPLICATION_CREDENTIALS: `${__dirname}\\test-sa.json` },
    stdio: 'inherit'
  });
  console.log("Indexes fetched successfully.");

  console.log("Deploying indexes to jw-system-f2104...");
  execSync('npx firebase deploy --only firestore:indexes --project jw-system-f2104', {
    env: { ...process.env, GOOGLE_APPLICATION_CREDENTIALS: `${__dirname}\\prod-sa.json` },
    stdio: 'inherit'
  });
  console.log("Indexes deployed successfully.");
} catch (error) {
  console.error("Error during firebase operations:", error);
} finally {
  // Cleanup
  fs.unlinkSync('test-sa.json');
  fs.unlinkSync('prod-sa.json');
}
