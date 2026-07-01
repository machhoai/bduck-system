import { readFileSync } from 'fs';
import { resolve } from 'path';
import crypto from 'crypto';

const env = readFileSync(resolve(process.cwd(), '../../.env.local'), 'utf-8');
process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 = env.match(/TEST_FIREBASE_SERVICE_ACCOUNT_BASE64="?(.*?)"?(\n|$)/)?.[1];
process.env.FIREBASE_PROJECT_ID = 'test-jw-system';

async function seed() {
    const { db } = await import('../config/firebase.js');
    const apiSecretHash = crypto.createHash("sha256").update("bduck_local_secret").digest("hex");
    
    // We should allow all warehouses or query existing warehouses
    const warehousesSnap = await db.collection("warehouses").get();
    const warehouseIds = warehousesSnap.docs.map(d => d.id);
    
    await db.collection("integration_clients").doc("ECOM_POS_001").set({
        id: "ECOM_POS_001",
        client_name: "E-Commerce System",
        api_key: "Bduck-Local-Integration-Key",
        api_secret_hash: apiSecretHash,
        scopes: [
            "scan",
            "locations.read",
            "products.read",
            "external_scan.write",
            "external_count.read",
            "external_count.write",
        ],
        allowed_warehouse_ids: warehouseIds, // Allow all for this POS
        ip_whitelist: ["127.0.0.1", "::1", "0.0.0.0"],
        rate_limit_per_minute: 1000,
        is_active: true,
        created_by: "SYSTEM_SEED",
        created_at: new Date()
    }, { merge: true });
    console.log("Seeded ECOM_POS_001 with warehouses:", warehouseIds);
}
seed().catch(console.error).finally(() => process.exit(0));
