// Automated Firestore Security Rules tests — runs against the LOCAL EMULATOR only.
// Never touches your real project. Safe to re-run any time, for any future rules change.
//
// Run with:
//   firebase emulators:exec --only firestore "node rules-tests.mjs"
//
// That command starts a throwaway local Firestore emulator, runs this script
// against it, prints results, then shuts the emulator down automatically.

import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import { doc, setDoc, updateDoc } from "firebase/firestore";

const PROJECT_ID = "demo-campushub-rules-test"; // fake id, local emulator only

const listingData = (overrides = {}) => ({
  sellerId: "approved-user",
  title: "x",
  description: "x",
  price: 5,
  category: "books",
  photos: ["test.jpg"],
  status: "active",
  ...overrides,
});

async function main() {
  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });

  // ---- Seed test personas + one existing listing, bypassing rules ----
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "users/approved-user"), { approved: true, banned: false, role: "student" });
    await setDoc(doc(db, "users/other-approved-user"), { approved: true, banned: false, role: "student" });
    await setDoc(doc(db, "users/pending-user"), { approved: false, banned: false, role: "student" });
    await setDoc(doc(db, "users/banned-user"), { approved: true, banned: true, role: "student" });
    await setDoc(doc(db, "users/admin-user"), { approved: true, banned: false, role: "admin" });
    await setDoc(doc(db, "listings/listing1"), listingData({ sellerId: "approved-user" }));
  });

  const results = [];
  const run = async (name, fn) => {
    try {
      await fn();
      results.push({ name, pass: true });
      console.log(`✅ ${name}`);
    } catch (err) {
      results.push({ name, pass: false });
      console.log(`❌ ${name}`);
      console.log(`   ${err.message}`);
    }
  };
  const resetListing1 = () =>
    testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), "listings/listing1"), { status: "active" });
    });

  // 1. Approved student creates a listing, as themselves.
  await run("1. approved student creates listing -> Allow", async () => {
    const db = testEnv.authenticatedContext("approved-user").firestore();
    await assertSucceeds(setDoc(doc(db, "listings/case1"), listingData({ sellerId: "approved-user" })));
  });

  // 2. Pending student creates a listing, as themselves.
  await run("2. pending student creates listing -> Deny", async () => {
    const db = testEnv.authenticatedContext("pending-user").firestore();
    await assertFails(setDoc(doc(db, "listings/case2"), listingData({ sellerId: "pending-user" })));
  });

  // 3. Banned student creates a listing, as themselves.
  await run("3. banned student creates listing -> Deny", async () => {
    const db = testEnv.authenticatedContext("banned-user").firestore();
    await assertFails(setDoc(doc(db, "listings/case3"), listingData({ sellerId: "banned-user" })));
  });

  // 4. Approved student spoofs someone else's sellerId.
  await run("4. sellerId mismatch -> Deny", async () => {
    const db = testEnv.authenticatedContext("approved-user").firestore();
    await assertFails(setDoc(doc(db, "listings/case4"), listingData({ sellerId: "other-approved-user" })));
  });

  // 5. A different approved student edits someone else's listing.
  await run("5. stranger edits listing price -> Deny", async () => {
    const db = testEnv.authenticatedContext("other-approved-user").firestore();
    await assertFails(updateDoc(doc(db, "listings/listing1"), { price: 999 }));
  });

  // 6. Owner marks their own listing sold.
  await run("6. owner sets status=sold -> Allow", async () => {
    const db = testEnv.authenticatedContext("approved-user").firestore();
    await assertSucceeds(updateDoc(doc(db, "listings/listing1"), { status: "sold" }));
  });
  await resetListing1();

  // 7. Admin removes someone else's listing (status only).
  await run("7. admin sets status=removed -> Allow", async () => {
    const db = testEnv.authenticatedContext("admin-user").firestore();
    await assertSucceeds(updateDoc(doc(db, "listings/listing1"), { status: "removed" }));
  });
  await resetListing1();

  // 8. Admin tries to change price too, not just status.
  await run("8. admin changes price alongside status -> Deny", async () => {
    const db = testEnv.authenticatedContext("admin-user").firestore();
    await assertFails(updateDoc(doc(db, "listings/listing1"), { status: "removed", price: 1 }));
  });

  // 9. A user writes their own publicProfiles doc.
  await run("9. self publicProfiles write -> Allow", async () => {
    const db = testEnv.authenticatedContext("approved-user").firestore();
    await assertSucceeds(
      setDoc(doc(db, "publicProfiles/approved-user"), { name: "Test", photo: "", updatedAt: new Date() })
    );
  });

  // 10. A user tries to write someone else's publicProfiles doc.
  await run("10. cross-user publicProfiles write -> Deny", async () => {
    const db = testEnv.authenticatedContext("approved-user").firestore();
    await assertFails(
      setDoc(doc(db, "publicProfiles/other-approved-user"), { name: "Test", photo: "", updatedAt: new Date() })
    );
  });

  await testEnv.cleanup();

  const failed = results.filter((r) => !r.pass);
  console.log("");
  console.log(`${results.length - failed.length}/${results.length} passed`);
  if (failed.length > 0) {
    console.log("FAILED:", failed.map((f) => f.name).join(", "));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("Test script crashed:", err);
  process.exitCode = 1;
});
