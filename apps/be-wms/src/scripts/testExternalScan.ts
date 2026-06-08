import * as admin from "firebase-admin";
import crypto from "crypto";

// 1. Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();

const TEST_CLIENT_ID = "CLIENT_POS_001";
const TEST_API_KEY = "test_api_key_12345";
const TEST_API_SECRET = "test_api_secret_super_secure_999";
const TEST_WAREHOUSE_ID = "WH-MAIN-001"; // Make sure you have this warehouse in DB or change it
const TEST_LOCATION_ID = "LOC-MAIN-A1";  // Make sure you have this location in DB or change it
const TEST_PRODUCT_ID = "PROD-1001";     // Make sure you have this product in DB or change it

async function seedIntegrationClient() {
    console.log("🌱 Seeding Integration Client...");
    
    const apiSecretHash = crypto.createHash("sha256").update(TEST_API_SECRET).digest("hex");
    
    await db.collection("integration_clients").doc(TEST_CLIENT_ID).set({
        id: TEST_CLIENT_ID,
        client_name: "Test POS System",
        api_key: TEST_API_KEY,
        api_secret_hash: apiSecretHash,
        scopes: ["external_scan.write"],
        allowed_warehouse_ids: [TEST_WAREHOUSE_ID],
        ip_whitelist: ["127.0.0.1", "::1"],
        rate_limit_per_minute: 100,
        is_active: true,
        created_by: "SYSTEM_SEED",
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        last_used_at: null
    });
    
    console.log("✅ Seeded Integration Client:", TEST_CLIENT_ID);
}

function generateSignature(method: string, path: string, timestamp: string, body: any): string {
    const payloadString = `${method.toUpperCase()}|${path}|${timestamp}|${JSON.stringify(body)}`;
    return crypto.createHmac("sha256", TEST_API_SECRET).update(payloadString).digest("hex");
}

async function sendTestRequest() {
    console.log("🚀 Sending Test Request to /api/external-scan/receive ...");
    
    const body = {
        scans: [
            {
                warehouse_id: TEST_WAREHOUSE_ID,
                warehouse_location_id: TEST_LOCATION_ID,
                product_id: TEST_PRODUCT_ID,
                barcode_scanned: "1234567890123",
                quantity: 2,
                unit_price: 150000,
                scan_time: new Date().toISOString(),
                operator_name: "Thu Ngân 1",
                operator_id_external: "NV001",
                device_id: "POS-01",
                batch_id: `BATCH-${Date.now()}`,
                notes: "Bán lẻ tại quầy"
            }
        ]
    };
    
    const method = "POST";
    const path = "/api/external-scan/receive";
    const timestamp = Date.now().toString();
    const signature = generateSignature(method, path, timestamp, body);
    
    try {
        const response = await fetch(`http://localhost:5000${path}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": TEST_API_KEY,
                "x-timestamp": timestamp,
                "x-signature": signature
            },
            body: JSON.stringify(body)
        });
        
        const data: any = await response.json();
        
        if (response.ok) {
            console.log("✅ Request Successful!");
            console.log("Response:", data);
        } else {
            console.log("❌ Request Failed!");
            console.log("Status:", response.status);
            console.log("Data:", data);
        }
    } catch (error: any) {
        console.error("❌ Request Failed!");
        console.error(error.message);
    }
}

async function main() {
    try {
        await seedIntegrationClient();
        console.log("---");
        console.log("Waiting 2 seconds for DB to persist...");
        await new Promise(resolve => setTimeout(resolve, 2000));
        await sendTestRequest();
    } catch (error) {
        console.error("💥 Error during execution:", error);
    } finally {
        process.exit(0);
    }
}

main();
