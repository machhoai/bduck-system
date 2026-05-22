/**
 * Seed Script — Tạo dữ liệu ban đầu cho Firestore (TEST environment)
 *
 * Script này sẽ:
 * 1. Lấy user đã tạo trên Firebase Auth → tạo document tương ứng trong collection `users`
 * 2. Tạo role "ADMIN" trong collection `roles`
 * 3. Gán role cho user trong collection `user_warehouse_roles`
 *
 * Chạy: npx tsx scripts/seed-test-user.ts
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// --- 1. Init Firebase Admin ---
const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
if (!base64) {
  console.error('❌ Missing FIREBASE_SERVICE_ACCOUNT_BASE64');
  process.exit(1);
}

const serviceAccount = JSON.parse(
  Buffer.from(base64, 'base64').toString('utf-8')
);

initializeApp({ credential: cert(serviceAccount) });

const db = getFirestore();
const auth = getAuth();

// --- 2. Seed ---
async function seed() {
  console.log('🌱 Starting seed...\n');

  // List all Firebase Auth users
  const listResult = await auth.listUsers(10);

  if (listResult.users.length === 0) {
    console.error('❌ No users found in Firebase Auth. Create one first via Firebase Console.');
    process.exit(1);
  }

  console.log(`Found ${listResult.users.length} user(s) in Firebase Auth:\n`);

  for (const authUser of listResult.users) {
    console.log(`  → ${authUser.email} (uid: ${authUser.uid})`);

    // Check if user doc already exists
    const existingUser = await db.collection('users').doc(authUser.uid).get();
    if (existingUser.exists) {
      console.log(`    ✅ User doc already exists, skipping.`);
      continue;
    }

    // Create user document
    const userData = {
      id: authUser.uid,
      username: authUser.email?.split('@')[0] || 'admin',
      email: authUser.email || '',
      password_hash: '---managed-by-firebase-auth---',
      full_name: authUser.displayName || authUser.email?.split('@')[0] || 'Admin User',
      employee_id: `EMP-${Date.now()}`,
      status: 'ACTIVE',
      is_deleted: false,
      created_at: new Date(),
      updated_at: new Date(),
    };

    await db.collection('users').doc(authUser.uid).set(userData);
    console.log(`    ✅ Created user doc in Firestore`);
  }

  // --- 3. Create ADMIN role if not exists ---
  const adminRoleId = 'role-admin';
  const roleSnap = await db.collection('roles').doc(adminRoleId).get();

  if (!roleSnap.exists) {
    await db.collection('roles').doc(adminRoleId).set({
      id: adminRoleId,
      name: 'ADMIN',
      description: 'Full system administrator',
      permissions: {
        '*': true, // Admin wildcard — full access to everything
      },
      created_at: new Date(),
    });
    console.log(`\n✅ Created ADMIN role`);
  } else {
    // Always update permissions to latest format
    await db.collection('roles').doc(adminRoleId).update({
      permissions: { '*': true },
    });
    console.log(`\n✅ ADMIN role updated with wildcard permissions`);
  }

  // --- 4. Assign ADMIN role to first user ---
  const firstUser = listResult.users[0];
  const assignmentId = `${firstUser.uid}_${adminRoleId}`;
  const assignSnap = await db.collection('user_warehouse_roles').doc(assignmentId).get();

  if (!assignSnap.exists) {
    await db.collection('user_warehouse_roles').doc(assignmentId).set({
      id: assignmentId,
      user_id: firstUser.uid,
      warehouse_id: null, // global scope
      role_id: adminRoleId,
      assigned_by: firstUser.uid, // self-assigned for initial seed
      valid_from: new Date().toISOString().split('T')[0],
      valid_until: null,
      is_active: true,
      created_at: new Date(),
    });
    console.log(`✅ Assigned ADMIN role to ${firstUser.email}`);
  } else {
    console.log(`✅ Role assignment already exists for ${firstUser.email}`);
  }

  console.log('\n🎉 Seed completed!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
