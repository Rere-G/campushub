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
import { doc, setDoc, updateDoc, deleteDoc, getDoc } from "firebase/firestore";

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

const serviceData = (overrides = {}) => ({
  providerId: "approved-user",
  title: "x",
  description: "x",
  price: 5,
  category: "tutoring",
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

  // ---- Seed test personas + one existing listing/service, bypassing rules ----
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "users/approved-user"), { approved: true, banned: false, role: "student" });
    await setDoc(doc(db, "users/other-approved-user"), { approved: true, banned: false, role: "student" });
    await setDoc(doc(db, "users/pending-user"), { approved: false, banned: false, role: "student" });
    await setDoc(doc(db, "users/banned-user"), { approved: true, banned: true, role: "student" });
    await setDoc(doc(db, "users/admin-user"), { approved: true, banned: false, role: "admin" });
    await setDoc(doc(db, "listings/listing1"), listingData({ sellerId: "approved-user" }));
    await setDoc(doc(db, "services/service1"), serviceData({ providerId: "approved-user" }));
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
  const resetService1 = () =>
    testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), "services/service1"), { status: "active" });
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

  // 11. Approved student creates a service, as themselves.
  await run("11. approved student creates service -> Allow", async () => {
    const db = testEnv.authenticatedContext("approved-user").firestore();
    await assertSucceeds(setDoc(doc(db, "services/case11"), serviceData({ providerId: "approved-user" })));
  });

  // 12. Pending student creates a service, as themselves.
  await run("12. pending student creates service -> Deny", async () => {
    const db = testEnv.authenticatedContext("pending-user").firestore();
    await assertFails(setDoc(doc(db, "services/case12"), serviceData({ providerId: "pending-user" })));
  });

  // 13. Banned student creates a service, as themselves.
  await run("13. banned student creates service -> Deny", async () => {
    const db = testEnv.authenticatedContext("banned-user").firestore();
    await assertFails(setDoc(doc(db, "services/case13"), serviceData({ providerId: "banned-user" })));
  });

  // 14. Approved student spoofs someone else's providerId.
  await run("14. providerId mismatch -> Deny", async () => {
    const db = testEnv.authenticatedContext("approved-user").firestore();
    await assertFails(setDoc(doc(db, "services/case14"), serviceData({ providerId: "other-approved-user" })));
  });

  // 15. A different approved student edits someone else's service.
  await run("15. stranger edits service price -> Deny", async () => {
    const db = testEnv.authenticatedContext("other-approved-user").firestore();
    await assertFails(updateDoc(doc(db, "services/service1"), { price: 999 }));
  });

  // 16. Owner pauses their own service.
  await run("16. owner sets status=paused -> Allow", async () => {
    const db = testEnv.authenticatedContext("approved-user").firestore();
    await assertSucceeds(updateDoc(doc(db, "services/service1"), { status: "paused" }));
  });
  await resetService1();

  // 17. Admin removes someone else's service (status only).
  await run("17. admin sets status=removed -> Allow", async () => {
    const db = testEnv.authenticatedContext("admin-user").firestore();
    await assertSucceeds(updateDoc(doc(db, "services/service1"), { status: "removed" }));
  });
  await resetService1();

  // 18. Admin tries to change price too, not just status.
  await run("18. admin changes price alongside status -> Deny", async () => {
    const db = testEnv.authenticatedContext("admin-user").firestore();
    await assertFails(updateDoc(doc(db, "services/service1"), { status: "removed", price: 1 }));
  });

  // ---- Seed one existing save for the delete/read test cases ----
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "saves/approved-user_listing1"), {
      uid: "approved-user",
      itemId: "listing1",
      itemType: "listing",
      createdAt: new Date(),
    });
  });

  // 19. User saves a listing, correct doc id, uid, and itemType.
  await run("19. correct save create (listing) -> Allow", async () => {
    const db = testEnv.authenticatedContext("other-approved-user").firestore();
    await assertSucceeds(
      setDoc(doc(db, "saves/other-approved-user_listing1"), {
        uid: "other-approved-user",
        itemId: "listing1",
        itemType: "listing",
        createdAt: new Date(),
      })
    );
  });

  // 20. Same shape, but saving a service instead — proves itemType isn't
  // hardcoded to "listing" anywhere in the rule.
  await run("20. correct save create (service) -> Allow", async () => {
    const db = testEnv.authenticatedContext("other-approved-user").firestore();
    await assertSucceeds(
      setDoc(doc(db, "saves/other-approved-user_service1"), {
        uid: "other-approved-user",
        itemId: "service1",
        itemType: "service",
        createdAt: new Date(),
      })
    );
  });

  // 21. itemType missing entirely.
  await run("21. save without itemType -> Deny", async () => {
    const db = testEnv.authenticatedContext("other-approved-user").firestore();
    await assertFails(
      setDoc(doc(db, "saves/other-approved-user_listing1"), {
        uid: "other-approved-user",
        itemId: "listing1",
        createdAt: new Date(),
      })
    );
  });

  // 22. itemType set to something other than "listing"/"service".
  await run("22. save with invalid itemType -> Deny", async () => {
    const db = testEnv.authenticatedContext("other-approved-user").firestore();
    await assertFails(
      setDoc(doc(db, "saves/other-approved-user_listing1"), {
        uid: "other-approved-user",
        itemId: "listing1",
        itemType: "banana",
        createdAt: new Date(),
      })
    );
  });

  // 23. Doc id doesn't match "<uid>_<itemId>".
  await run("23. save with mismatched doc id -> Deny", async () => {
    const db = testEnv.authenticatedContext("other-approved-user").firestore();
    await assertFails(
      setDoc(doc(db, "saves/wrong-id"), {
        uid: "other-approved-user",
        itemId: "listing1",
        itemType: "listing",
        createdAt: new Date(),
      })
    );
  });

  // 24. uid field spoofed to someone else's, even with a matching-looking id.
  await run("24. save with spoofed uid field -> Deny", async () => {
    const db = testEnv.authenticatedContext("other-approved-user").firestore();
    await assertFails(
      setDoc(doc(db, "saves/approved-user_listing1"), {
        uid: "approved-user",
        itemId: "listing1",
        itemType: "listing",
        createdAt: new Date(),
      })
    );
  });

  // 25. Owner reads their own save.
  await run("25. owner reads own save -> Allow", async () => {
    const db = testEnv.authenticatedContext("approved-user").firestore();
    await assertSucceeds(getDoc(doc(db, "saves/approved-user_listing1")));
  });

  // 26. A different user tries to read someone else's save.
  await run("26. stranger reads someone else's save -> Deny", async () => {
    const db = testEnv.authenticatedContext("other-approved-user").firestore();
    await assertFails(getDoc(doc(db, "saves/approved-user_listing1")));
  });

  // 27. Owner deletes (unsaves) their own save.
  await run("27. owner deletes own save -> Allow", async () => {
    const db = testEnv.authenticatedContext("approved-user").firestore();
    await assertSucceeds(deleteDoc(doc(db, "saves/approved-user_listing1")));
  });

  // 28. Owner reads a save that doesn't exist yet (the "already saved?" lookup).
  await run("28. owner reads non-existent save -> Allow", async () => {
    const db = testEnv.authenticatedContext("approved-user").firestore();
    await assertSucceeds(getDoc(doc(db, "saves/approved-user_never-saved")));
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
