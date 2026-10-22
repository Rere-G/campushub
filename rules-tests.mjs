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
import {
  doc, setDoc, updateDoc, deleteDoc, getDoc, getDocs, collection, serverTimestamp,
  collectionGroup, query, where, orderBy, limit,
} from "firebase/firestore";

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

const commentData = (overrides = {}) => ({
  authorId: "other-approved-user",
  itemOwnerId: "approved-user",
  text: "Is this still available?",
  createdAt: serverTimestamp(),
  ...overrides,
});

const reportData = (overrides = {}) => ({
  reporterId: "third-user",
  targetType: "listing",
  itemType: "listing",
  itemId: "listing1",
  commentId: "",
  targetOwnerId: "approved-user",
  reason: "spam",
  note: "",
  status: "open",
  createdAt: serverTimestamp(),
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

  // ---- Seed for the comments cases: a removed listing/service, plus existing
  // comments (written by other-approved-user on approved-user's items) that the
  // delete cases can each consume one of. ----
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "listings/listing-removed"), listingData({ status: "removed" }));
    await setDoc(doc(db, "services/service-removed"), serviceData({ status: "removed" }));
    const old = { authorId: "other-approved-user", itemOwnerId: "approved-user", text: "hi", createdAt: new Date() };
    for (const id of ["del-author", "del-owner", "del-stranger", "del-admin", "del-update"]) {
      await setDoc(doc(db, `listings/listing1/comments/${id}`), old);
    }
    await setDoc(doc(db, "services/service1/comments/del-provider"), old);
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

  // ---- Comments (listings + services) ----

  // 29. Approved student asks a question on someone else's listing.
  await run("29. approved student comments on listing -> Allow", async () => {
    const db = testEnv.authenticatedContext("other-approved-user").firestore();
    await assertSucceeds(setDoc(doc(db, "listings/listing1/comments/c29"), commentData()));
  });

  // 30. The seller answers on their own listing (itemOwnerId is themselves).
  await run("30. owner comments on own listing -> Allow", async () => {
    const db = testEnv.authenticatedContext("approved-user").firestore();
    await assertSucceeds(
      setDoc(doc(db, "listings/listing1/comments/c30"), commentData({ authorId: "approved-user" }))
    );
  });

  // 31. Same, under a service.
  await run("31. approved student comments on service -> Allow", async () => {
    const db = testEnv.authenticatedContext("other-approved-user").firestore();
    await assertSucceeds(setDoc(doc(db, "services/service1/comments/c31"), commentData()));
  });

  // 32. Pending student.
  await run("32. pending student comments -> Deny", async () => {
    const db = testEnv.authenticatedContext("pending-user").firestore();
    await assertFails(
      setDoc(doc(db, "listings/listing1/comments/c32"), commentData({ authorId: "pending-user" }))
    );
  });

  // 33. Banned student.
  await run("33. banned student comments -> Deny", async () => {
    const db = testEnv.authenticatedContext("banned-user").firestore();
    await assertFails(
      setDoc(doc(db, "listings/listing1/comments/c33"), commentData({ authorId: "banned-user" }))
    );
  });

  // 34. Posting as someone else.
  await run("34. authorId spoofed -> Deny", async () => {
    const db = testEnv.authenticatedContext("other-approved-user").firestore();
    await assertFails(
      setDoc(doc(db, "listings/listing1/comments/c34"), commentData({ authorId: "approved-user" }))
    );
  });

  // 35. Forging itemOwnerId to claim delete rights over the thread.
  await run("35. itemOwnerId forged to self -> Deny", async () => {
    const db = testEnv.authenticatedContext("other-approved-user").firestore();
    await assertFails(
      setDoc(doc(db, "listings/listing1/comments/c35"), commentData({ itemOwnerId: "other-approved-user" }))
    );
  });

  // 36. Empty text.
  await run("36. empty text -> Deny", async () => {
    const db = testEnv.authenticatedContext("other-approved-user").firestore();
    await assertFails(setDoc(doc(db, "listings/listing1/comments/c36"), commentData({ text: "" })));
  });

  // 37. 501 characters (limit is 500).
  await run("37. text over 500 characters -> Deny", async () => {
    const db = testEnv.authenticatedContext("other-approved-user").firestore();
    await assertFails(
      setDoc(doc(db, "listings/listing1/comments/c37"), commentData({ text: "a".repeat(501) }))
    );
  });

  // 37b. Exactly 500 is fine.
  await run("38. text of exactly 500 characters -> Allow", async () => {
    const db = testEnv.authenticatedContext("other-approved-user").firestore();
    await assertSucceeds(
      setDoc(doc(db, "listings/listing1/comments/c38"), commentData({ text: "a".repeat(500) }))
    );
  });

  // 39. An extra, unexpected field.
  await run("39. extra field on comment -> Deny", async () => {
    const db = testEnv.authenticatedContext("other-approved-user").firestore();
    await assertFails(
      setDoc(doc(db, "listings/listing1/comments/c39"), commentData({ isPinned: true }))
    );
  });

  // 40. Client-chosen timestamp instead of the server's.
  await run("40. client-set createdAt -> Deny", async () => {
    const db = testEnv.authenticatedContext("other-approved-user").firestore();
    await assertFails(
      setDoc(doc(db, "listings/listing1/comments/c40"), commentData({ createdAt: new Date("2020-01-01") }))
    );
  });

  // 41. Parent listing doesn't exist.
  await run("41. comment on non-existent listing -> Deny", async () => {
    const db = testEnv.authenticatedContext("other-approved-user").firestore();
    await assertFails(setDoc(doc(db, "listings/no-such-listing/comments/c41"), commentData()));
  });

  // 42. Parent listing was removed.
  await run("42. comment on removed listing -> Deny", async () => {
    const db = testEnv.authenticatedContext("other-approved-user").firestore();
    await assertFails(setDoc(doc(db, "listings/listing-removed/comments/c42"), commentData()));
  });

  // 43. Parent service was removed.
  await run("43. comment on removed service -> Deny", async () => {
    const db = testEnv.authenticatedContext("other-approved-user").firestore();
    await assertFails(setDoc(doc(db, "services/service-removed/comments/c43"), commentData()));
  });

  // 44. Comments are never edited in place — not even by their author.
  await run("44. author edits own comment -> Deny", async () => {
    const db = testEnv.authenticatedContext("other-approved-user").firestore();
    await assertFails(updateDoc(doc(db, "listings/listing1/comments/del-update"), { text: "edited" }));
  });

  // 45. Author deletes their own comment.
  await run("45. author deletes own comment -> Allow", async () => {
    const db = testEnv.authenticatedContext("other-approved-user").firestore();
    await assertSucceeds(deleteDoc(doc(db, "listings/listing1/comments/del-author")));
  });

  // 46. The listing's owner removes someone else's comment.
  await run("46. listing owner deletes others' comment -> Allow", async () => {
    const db = testEnv.authenticatedContext("approved-user").firestore();
    await assertSucceeds(deleteDoc(doc(db, "listings/listing1/comments/del-owner")));
  });

  // 47. The service's provider removes someone else's comment.
  await run("47. service provider deletes others' comment -> Allow", async () => {
    const db = testEnv.authenticatedContext("approved-user").firestore();
    await assertSucceeds(deleteDoc(doc(db, "services/service1/comments/del-provider")));
  });

  // 48. A bystander who is neither author nor owner.
  await run("48. stranger deletes others' comment -> Deny", async () => {
    const db = testEnv.authenticatedContext("pending-user").firestore();
    await assertFails(deleteDoc(doc(db, "listings/listing1/comments/del-stranger")));
  });

  // 49. Admin moderation.
  await run("49. admin deletes any comment -> Allow", async () => {
    const db = testEnv.authenticatedContext("admin-user").firestore();
    await assertSucceeds(deleteDoc(doc(db, "listings/listing1/comments/del-admin")));
  });

  // 50. Any signed-in user can read a thread (the page's own list query).
  await run("50. signed-in user lists a comment thread -> Allow", async () => {
    const db = testEnv.authenticatedContext("pending-user").firestore();
    await assertSucceeds(getDocs(collection(db, "listings/listing1/comments")));
  });

  // 51. Signed-out visitors can't read comments.
  await run("51. signed-out user reads comments -> Deny", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDocs(collection(db, "listings/listing1/comments")));
  });

  // ---- Reports ----
  // Seed: a third approved student (the reporter), one comment under listing1
  // and one under service1 (both by other-approved-user), and one existing
  // report for the read/update cases.
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "users/third-user"), { approved: true, banned: false, role: "student" });
    // Only used by the Deny cases below, so none of them can collide with a
    // report that an Allow case already created.
    await setDoc(doc(db, "services/service-neg"), serviceData({ providerId: "approved-user" }));
    const cm = { authorId: "other-approved-user", itemOwnerId: "approved-user", text: "hi", createdAt: new Date() };
    await setDoc(doc(db, "listings/listing1/comments/rc1"), cm);
    await setDoc(doc(db, "services/service1/comments/rc2"), cm);
    await setDoc(doc(db, "reports/other-approved-user_listing1"), {
      reporterId: "other-approved-user",
      targetType: "listing",
      itemType: "listing",
      itemId: "listing1",
      commentId: "",
      targetOwnerId: "approved-user",
      reason: "spam",
      note: "",
      status: "open",
      createdAt: new Date(),
    });
  });

  // 52. Report a listing.
  await run("52. approved student reports a listing -> Allow", async () => {
    const db = testEnv.authenticatedContext("third-user").firestore();
    await assertSucceeds(setDoc(doc(db, "reports/third-user_listing1"), reportData()));
  });

  // 53. Report a service.
  await run("53. approved student reports a service -> Allow", async () => {
    const db = testEnv.authenticatedContext("third-user").firestore();
    await assertSucceeds(
      setDoc(
        doc(db, "reports/third-user_service1"),
        reportData({ targetType: "service", itemType: "service", itemId: "service1" })
      )
    );
  });

  // 54. Report a comment under a listing (owner = the comment's author).
  await run("54. approved student reports a listing comment -> Allow", async () => {
    const db = testEnv.authenticatedContext("third-user").firestore();
    await assertSucceeds(
      setDoc(
        doc(db, "reports/third-user_listing1_rc1"),
        reportData({ targetType: "comment", commentId: "rc1", targetOwnerId: "other-approved-user" })
      )
    );
  });

  // 55. Report a comment under a service.
  await run("55. approved student reports a service comment -> Allow", async () => {
    const db = testEnv.authenticatedContext("third-user").firestore();
    await assertSucceeds(
      setDoc(
        doc(db, "reports/third-user_service1_rc2"),
        reportData({
          targetType: "comment",
          itemType: "service",
          itemId: "service1",
          commentId: "rc2",
          targetOwnerId: "other-approved-user",
        })
      )
    );
  });

  // 56. Reporting the same listing twice (case 52 already did).
  await run("56. duplicate report -> Deny", async () => {
    const db = testEnv.authenticatedContext("third-user").firestore();
    await assertFails(setDoc(doc(db, "reports/third-user_listing1"), reportData({ reason: "scam" })));
  });

  // 57. Pending student.
  await run("57. pending student reports -> Deny", async () => {
    const db = testEnv.authenticatedContext("pending-user").firestore();
    await assertFails(
      setDoc(doc(db, "reports/pending-user_listing1"), reportData({ reporterId: "pending-user" }))
    );
  });

  // 58. Banned student.
  await run("58. banned student reports -> Deny", async () => {
    const db = testEnv.authenticatedContext("banned-user").firestore();
    await assertFails(
      setDoc(doc(db, "reports/banned-user_listing1"), reportData({ reporterId: "banned-user" }))
    );
  });

  // 59. Filing a report in someone else's name. The id and every other field
  // are valid, so the ONLY thing wrong is reporterId.
  await run("59. reporterId spoofed -> Deny", async () => {
    const db = testEnv.authenticatedContext("third-user").firestore();
    await assertFails(
      setDoc(
        doc(db, "reports/third-user_service-neg"),
        reportData({
          targetType: "service",
          itemType: "service",
          itemId: "service-neg",
          reporterId: "other-approved-user",
        })
      )
    );
  });

  // 60. Naming the wrong person as the poster (would let a ban hit them).
  await run("60. targetOwnerId forged -> Deny", async () => {
    const db = testEnv.authenticatedContext("third-user").firestore();
    await assertFails(
      setDoc(
        doc(db, "reports/third-user_service-neg"),
        reportData({ targetType: "service", itemType: "service", itemId: "service-neg", targetOwnerId: "admin-user" })
      )
    );
  });

  // 61. Reporting your own listing.
  await run("61. self-report -> Deny", async () => {
    const db = testEnv.authenticatedContext("approved-user").firestore();
    await assertFails(
      setDoc(doc(db, "reports/approved-user_listing1"), reportData({ reporterId: "approved-user" }))
    );
  });

  // 62. The listing doesn't exist.
  await run("62. report non-existent listing -> Deny", async () => {
    const db = testEnv.authenticatedContext("third-user").firestore();
    await assertFails(
      setDoc(doc(db, "reports/third-user_no-such-listing"), reportData({ itemId: "no-such-listing" }))
    );
  });

  // 63. Reason outside the fixed list.
  await run("63. invalid reason -> Deny", async () => {
    const db = testEnv.authenticatedContext("third-user").firestore();
    await assertFails(
      setDoc(
        doc(db, "reports/third-user_service-neg"),
        reportData({ targetType: "service", itemType: "service", itemId: "service-neg", reason: "boring" })
      )
    );
  });

  // 64. Note over 300 characters.
  await run("64. note over 300 characters -> Deny", async () => {
    const db = testEnv.authenticatedContext("third-user").firestore();
    await assertFails(
      setDoc(
        doc(db, "reports/third-user_service-neg"),
        reportData({ targetType: "service", itemType: "service", itemId: "service-neg", note: "a".repeat(301) })
      )
    );
  });

  // 65. Doc id that doesn't follow "<uid>_<itemId>".
  await run("65. report with wrong doc id -> Deny", async () => {
    const db = testEnv.authenticatedContext("third-user").firestore();
    await assertFails(setDoc(doc(db, "reports/some-random-id"), reportData()));
  });

  // 66. Client-chosen timestamp.
  await run("66. client-set createdAt -> Deny", async () => {
    const db = testEnv.authenticatedContext("third-user").firestore();
    await assertFails(
      setDoc(
        doc(db, "reports/third-user_service-neg"),
        reportData({
          targetType: "service",
          itemType: "service",
          itemId: "service-neg",
          createdAt: new Date("2020-01-01"),
        })
      )
    );
  });

  // 67. Arriving already resolved.
  await run("67. report created as actioned -> Deny", async () => {
    const db = testEnv.authenticatedContext("third-user").firestore();
    await assertFails(
      setDoc(
        doc(db, "reports/third-user_service-neg"),
        reportData({ targetType: "service", itemType: "service", itemId: "service-neg", status: "actioned" })
      )
    );
  });

  // 68. Reporter reads their own report.
  await run("68. reporter reads own report -> Allow", async () => {
    const db = testEnv.authenticatedContext("other-approved-user").firestore();
    await assertSucceeds(getDoc(doc(db, "reports/other-approved-user_listing1")));
  });

  // 69. "Have I reported this already?" lookup on a report that doesn't exist.
  await run("69. reporter reads own non-existent report -> Allow", async () => {
    const db = testEnv.authenticatedContext("other-approved-user").firestore();
    await assertSucceeds(getDoc(doc(db, "reports/other-approved-user_service1")));
  });

  // 70. Someone else's report.
  await run("70. stranger reads someone else's report -> Deny", async () => {
    const db = testEnv.authenticatedContext("approved-user").firestore();
    await assertFails(getDoc(doc(db, "reports/other-approved-user_listing1")));
  });

  // 71. A student listing all reports.
  await run("71. student lists reports -> Deny", async () => {
    const db = testEnv.authenticatedContext("third-user").firestore();
    await assertFails(getDocs(collection(db, "reports")));
  });

  // 72. Admin listing all reports (the Reports tab).
  await run("72. admin lists reports -> Allow", async () => {
    const db = testEnv.authenticatedContext("admin-user").firestore();
    await assertSucceeds(getDocs(collection(db, "reports")));
  });

  // 73. Admin dismisses a report.
  await run("73. admin resolves a report -> Allow", async () => {
    const db = testEnv.authenticatedContext("admin-user").firestore();
    await assertSucceeds(
      updateDoc(doc(db, "reports/other-approved-user_listing1"), {
        status: "dismissed",
        action: "dismissed",
        resolvedBy: "admin-user",
        resolvedAt: serverTimestamp(),
      })
    );
  });

  // 74. Admin rewriting what the student reported.
  await run("74. admin changes the reason -> Deny", async () => {
    const db = testEnv.authenticatedContext("admin-user").firestore();
    await assertFails(
      updateDoc(doc(db, "reports/third-user_listing1"), {
        status: "dismissed",
        action: "dismissed",
        resolvedBy: "admin-user",
        resolvedAt: serverTimestamp(),
        reason: "other",
      })
    );
  });

  // 75. Reporter resolving their own report.
  await run("75. reporter updates own report -> Deny", async () => {
    const db = testEnv.authenticatedContext("third-user").firestore();
    await assertFails(
      updateDoc(doc(db, "reports/third-user_listing1"), {
        status: "dismissed",
        action: "dismissed",
        resolvedBy: "third-user",
        resolvedAt: serverTimestamp(),
      })
    );
  });

  // 76. Nobody deletes reports, not even admins.
  await run("76. admin deletes a report -> Deny", async () => {
    const db = testEnv.authenticatedContext("admin-user").firestore();
    await assertFails(deleteDoc(doc(db, "reports/third-user_listing1")));
  });

  // ---- Activity feed (collection-group query over all comments) ----

  // 77. Owner pulls the questions on their own listings and services.
  await run("77. owner collection-group query on own comments -> Allow", async () => {
    const db = testEnv.authenticatedContext("approved-user").firestore();
    await assertSucceeds(
      getDocs(
        query(
          collectionGroup(db, "comments"),
          where("itemOwnerId", "==", "approved-user"),
          orderBy("createdAt", "desc"),
          limit(20)
        )
      )
    );
  });

  // 78. Signed-out visitor runs the same query.
  await run("78. signed-out collection-group query -> Deny", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      getDocs(
        query(
          collectionGroup(db, "comments"),
          where("itemOwnerId", "==", "approved-user"),
          orderBy("createdAt", "desc"),
          limit(20)
        )
      )
    );
  });

  // ---- My Saved page (listing your own saves) ----
  // By now other-approved-user has saves from tests 19 and 20.

  // 79. Owner lists their own saves (uid filter = themselves).
  await run("79. owner lists own saves -> Allow", async () => {
    const db = testEnv.authenticatedContext("other-approved-user").firestore();
    await assertSucceeds(
      getDocs(query(collection(db, "saves"), where("uid", "==", "other-approved-user")))
    );
  });

  // 80. Listing every save with no uid filter.
  await run("80. list all saves without uid filter -> Deny", async () => {
    const db = testEnv.authenticatedContext("other-approved-user").firestore();
    await assertFails(getDocs(collection(db, "saves")));
  });

  // 81. Listing someone else's saves.
  await run("81. list another user's saves -> Deny", async () => {
    const db = testEnv.authenticatedContext("approved-user").firestore();
    await assertFails(
      getDocs(query(collection(db, "saves"), where("uid", "==", "other-approved-user")))
    );
  });

  // ---- Moderation lock: owners can't undo an admin removal (stage 14) ----
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "listings/mod-l"), listingData({ sellerId: "approved-user" }));
    await setDoc(doc(db, "services/mod-s"), serviceData({ providerId: "approved-user" }));
  });

  // 82. Admin removes a listing and sets the lock.
  await run("82. admin removes listing with removedByAdmin -> Allow", async () => {
    const db = testEnv.authenticatedContext("admin-user").firestore();
    await assertSucceeds(updateDoc(doc(db, "listings/mod-l"), { status: "removed", removedByAdmin: true }));
  });

  // 83. Owner tries to bring the admin-removed listing back.
  await run("83. owner restores admin-removed listing -> Deny", async () => {
    const db = testEnv.authenticatedContext("approved-user").firestore();
    await assertFails(updateDoc(doc(db, "listings/mod-l"), { status: "active" }));
  });

  // 84. Owner clears the lock and restores in one write.
  await run("84. owner clears lock + restores listing -> Deny", async () => {
    const db = testEnv.authenticatedContext("approved-user").firestore();
    await assertFails(updateDoc(doc(db, "listings/mod-l"), { status: "active", removedByAdmin: false }));
  });

  // 85. Admin sets the lock on a post that isn't removed.
  await run("85. admin sets removedByAdmin on an active listing -> Deny", async () => {
    const db = testEnv.authenticatedContext("admin-user").firestore();
    await assertFails(updateDoc(doc(db, "listings/mod-l"), { status: "active", removedByAdmin: true }));
  });

  // 86. Admin restores it and clears the lock.
  await run("86. admin restores listing and clears lock -> Allow", async () => {
    const db = testEnv.authenticatedContext("admin-user").firestore();
    await assertSucceeds(updateDoc(doc(db, "listings/mod-l"), { status: "active", removedByAdmin: false }));
  });

  // 87. Owner removes their own listing (no lock involved).
  await run("87. owner removes own listing -> Allow", async () => {
    const db = testEnv.authenticatedContext("approved-user").firestore();
    await assertSucceeds(updateDoc(doc(db, "listings/mod-l"), { status: "removed" }));
  });

  // 88. Owner restores their OWN removal — still allowed.
  await run("88. owner restores own removed listing -> Allow", async () => {
    const db = testEnv.authenticatedContext("approved-user").firestore();
    await assertSucceeds(updateDoc(doc(db, "listings/mod-l"), { status: "active" }));
  });

  // 89. Owner locks their own listing (owners never touch the flag).
  await run("89. owner sets removedByAdmin on own listing -> Deny", async () => {
    const db = testEnv.authenticatedContext("approved-user").firestore();
    await assertFails(updateDoc(doc(db, "listings/mod-l"), { status: "removed", removedByAdmin: true }));
  });

  // 90. Admin removes a service and sets the lock.
  await run("90. admin removes service with removedByAdmin -> Allow", async () => {
    const db = testEnv.authenticatedContext("admin-user").firestore();
    await assertSucceeds(updateDoc(doc(db, "services/mod-s"), { status: "removed", removedByAdmin: true }));
  });

  // 91. Provider tries to resume the admin-removed service.
  await run("91. owner restores admin-removed service -> Deny", async () => {
    const db = testEnv.authenticatedContext("approved-user").firestore();
    await assertFails(updateDoc(doc(db, "services/mod-s"), { status: "active" }));
  });

  // 92. Admin restores the service and clears the lock.
  await run("92. admin restores service and clears lock -> Allow", async () => {
    const db = testEnv.authenticatedContext("admin-user").firestore();
    await assertSucceeds(updateDoc(doc(db, "services/mod-s"), { status: "active", removedByAdmin: false }));
  });

  // ---- Notifications (stage 14c) ----
  const notifRemoved = (overrides = {}) => ({
    uid: "approved-user",
    type: "post_removed",
    itemType: "listing",
    itemId: "listing1",
    itemTitle: "x",
    reason: "spam",
    createdAt: serverTimestamp(),
    ...overrides,
  });
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "notifications/seed-n1"), {
      uid: "approved-user", type: "account_approved", createdAt: new Date(),
    });
  });

  // 93. Admin tells a student their listing was removed.
  await run("93. admin creates post_removed notification -> Allow", async () => {
    const db = testEnv.authenticatedContext("admin-user").firestore();
    await assertSucceeds(setDoc(doc(db, "notifications/n93"), notifRemoved()));
  });

  // 94. A student writes a notification (e.g. to spoof a 'removed' message).
  await run("94. student creates a notification -> Deny", async () => {
    const db = testEnv.authenticatedContext("other-approved-user").firestore();
    await assertFails(setDoc(doc(db, "notifications/n94"), notifRemoved()));
  });

  // 95. Admin adds a field outside the shape.
  await run("95. notification with an extra field -> Deny", async () => {
    const db = testEnv.authenticatedContext("admin-user").firestore();
    await assertFails(setDoc(doc(db, "notifications/n95"), notifRemoved({ message: "hi" })));
  });

  // 96. Admin backdates createdAt instead of using the server time.
  await run("96. notification with client createdAt -> Deny", async () => {
    const db = testEnv.authenticatedContext("admin-user").firestore();
    await assertFails(setDoc(doc(db, "notifications/n96"), notifRemoved({ createdAt: new Date(2020, 0, 1) })));
  });

  // 97. post_removed with a reason that isn't on the list.
  await run("97. post_removed with an unknown reason -> Deny", async () => {
    const db = testEnv.authenticatedContext("admin-user").firestore();
    await assertFails(setDoc(doc(db, "notifications/n97"), notifRemoved({ reason: "because" })));
  });

  // 98. report_handled with an unknown outcome.
  await run("98. report_handled with an unknown outcome -> Deny", async () => {
    const db = testEnv.authenticatedContext("admin-user").firestore();
    await assertFails(
      setDoc(doc(db, "notifications/n98"), {
        uid: "third-user", type: "report_handled", itemType: "listing", itemId: "listing1",
        itemTitle: "x", outcome: "ignored", createdAt: serverTimestamp(),
      })
    );
  });

  // 99. account_approved carrying extra item fields.
  await run("99. account_approved with item fields -> Deny", async () => {
    const db = testEnv.authenticatedContext("admin-user").firestore();
    await assertFails(
      setDoc(doc(db, "notifications/n99"), {
        uid: "approved-user", type: "account_approved", itemId: "listing1", createdAt: serverTimestamp(),
      })
    );
  });

  // 100. Student lists their own notifications.
  await run("100. student lists own notifications -> Allow", async () => {
    const db = testEnv.authenticatedContext("approved-user").firestore();
    await assertSucceeds(getDocs(query(collection(db, "notifications"), where("uid", "==", "approved-user"))));
  });

  // 101. Student lists someone else's.
  await run("101. student lists another user's notifications -> Deny", async () => {
    const db = testEnv.authenticatedContext("other-approved-user").firestore();
    await assertFails(getDocs(query(collection(db, "notifications"), where("uid", "==", "approved-user"))));
  });

  // 102. Listing every notification with no uid filter.
  await run("102. list all notifications without uid filter -> Deny", async () => {
    const db = testEnv.authenticatedContext("approved-user").firestore();
    await assertFails(getDocs(collection(db, "notifications")));
  });

  // 103. Owner edits their notification (read-only for everyone).
  await run("103. owner updates own notification -> Deny", async () => {
    const db = testEnv.authenticatedContext("approved-user").firestore();
    await assertFails(updateDoc(doc(db, "notifications/seed-n1"), { type: "post_removed" }));
  });

  // 104. Owner deletes their notification.
  await run("104. owner deletes own notification -> Deny", async () => {
    const db = testEnv.authenticatedContext("approved-user").firestore();
    await assertFails(deleteDoc(doc(db, "notifications/seed-n1")));
  });

  // ---- Chat (stage 15) ----
  // Seller: approved-user (owns listing1 / service1). Buyer: other-approved-user.
  // Outsider: third-user. Conversation id = itemId_buyerUid.
  const CONV = "conversations/listing1_other-approved-user";
  const convData = (overrides = {}) => ({
    itemType: "listing",
    itemId: "listing1",
    itemTitle: "x",
    buyerId: "other-approved-user",
    sellerId: "approved-user",
    participants: ["other-approved-user", "approved-user"],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastMessage: "",
    lastSenderId: "",
    ...overrides,
  });
  const textMsg = (senderId, text = "Is it still available?") => ({
    senderId, type: "text", text, createdAt: serverTimestamp(),
  });
  const inDays = (d) => new Date(Date.now() + d * 24 * 60 * 60 * 1000);
  const meetingMsg = (senderId, overrides = {}) => ({
    senderId, type: "meeting", spot: "library", meetAt: inDays(2), status: "pending",
    createdAt: serverTimestamp(), ...overrides,
  });
  const asBuyer = () => testEnv.authenticatedContext("other-approved-user").firestore();
  const asSeller = () => testEnv.authenticatedContext("approved-user").firestore();
  const asOutsider = () => testEnv.authenticatedContext("third-user").firestore();

  // 105. Buyer starts a chat about listing1.
  await run("105. buyer creates conversation -> Allow", async () => {
    await assertSucceeds(setDoc(doc(asBuyer(), CONV), convData()));
  });

  // 106. Chat id doesn't end in the creator's uid.
  await run("106. conversation id for someone else -> Deny", async () => {
    await assertFails(setDoc(doc(asBuyer(), "conversations/service1_third-user"),
      convData({ itemType: "service", itemId: "service1" })));
  });

  // 107. sellerId isn't the item's real owner.
  await run("107. conversation with a fake seller -> Deny", async () => {
    await assertFails(setDoc(doc(asBuyer(), "conversations/service1_other-approved-user"),
      convData({ itemType: "service", itemId: "service1", sellerId: "third-user",
                 participants: ["other-approved-user", "third-user"] })));
  });

  // 108. Owner messages themselves about their own item.
  await run("108. seller starts chat with self -> Deny", async () => {
    await assertFails(setDoc(doc(asSeller(), "conversations/service1_approved-user"),
      convData({ itemType: "service", itemId: "service1", buyerId: "approved-user",
                 participants: ["approved-user", "approved-user"] })));
  });

  // 109. Chat about a removed listing.
  await run("109. conversation on a removed listing -> Deny", async () => {
    await assertFails(setDoc(doc(asBuyer(), "conversations/listing-removed_other-approved-user"),
      convData({ itemId: "listing-removed" })));
  });

  // 110. Pending (unapproved) student starts a chat.
  await run("110. pending user creates conversation -> Deny", async () => {
    const db = testEnv.authenticatedContext("pending-user").firestore();
    await assertFails(setDoc(doc(db, "conversations/service1_pending-user"),
      convData({ itemType: "service", itemId: "service1", buyerId: "pending-user",
                 participants: ["pending-user", "approved-user"] })));
  });

  // 111. Outsider reads the chat.
  await run("111. outsider reads conversation -> Deny", async () => {
    await assertFails(getDoc(doc(asOutsider(), CONV)));
  });

  // 112. Buyer checks for a chat that doesn't exist yet ("already chatting?").
  await run("112. buyer looks up own not-yet-created chat -> Allow", async () => {
    await assertSucceeds(getDoc(doc(asBuyer(), "conversations/service1_other-approved-user")));
  });

  // 113. Inbox query (participants array-contains me).
  await run("113. participant lists own conversations -> Allow", async () => {
    await assertSucceeds(getDocs(query(collection(asSeller(), "conversations"),
      where("participants", "array-contains", "approved-user"))));
  });

  // 114. Listing every conversation.
  await run("114. list all conversations without filter -> Deny", async () => {
    await assertFails(getDocs(collection(asSeller(), "conversations")));
  });

  // 115-116. Both participants can send text.
  await run("115. buyer sends a text message -> Allow", async () => {
    await assertSucceeds(setDoc(doc(asBuyer(), `${CONV}/messages/m1`), textMsg("other-approved-user")));
  });
  await run("116. seller sends a text message -> Allow", async () => {
    await assertSucceeds(setDoc(doc(asSeller(), `${CONV}/messages/m2`), textMsg("approved-user", "Yes it is")));
  });

  // 117. Outsider writes into the chat.
  await run("117. outsider sends a message -> Deny", async () => {
    await assertFails(setDoc(doc(asOutsider(), `${CONV}/messages/m3`), textMsg("third-user")));
  });

  // 118. Buyer sends a message pretending to be the seller.
  await run("118. message with spoofed senderId -> Deny", async () => {
    await assertFails(setDoc(doc(asBuyer(), `${CONV}/messages/m4`), textMsg("approved-user")));
  });

  // 119-120. Empty and too-long text.
  await run("119. empty text message -> Deny", async () => {
    await assertFails(setDoc(doc(asBuyer(), `${CONV}/messages/m5`), textMsg("other-approved-user", "")));
  });
  await run("120. 1001-character message -> Deny", async () => {
    await assertFails(setDoc(doc(asBuyer(), `${CONV}/messages/m6`), textMsg("other-approved-user", "a".repeat(1001))));
  });

  // 121. Buyer updates the inbox preview after sending (and marks own read).
  await run("121. sender updates preview + own read time -> Allow", async () => {
    await assertSucceeds(updateDoc(doc(asBuyer(), CONV), {
      lastMessage: "Is it still available?", lastSenderId: "other-approved-user",
      updatedAt: serverTimestamp(), buyerReadAt: serverTimestamp(),
    }));
  });

  // 122. Preview claims the other person sent it.
  await run("122. preview with someone else as lastSenderId -> Deny", async () => {
    await assertFails(updateDoc(doc(asBuyer(), CONV), {
      lastMessage: "x", lastSenderId: "approved-user", updatedAt: serverTimestamp(),
    }));
  });

  // 123-124. Read times: only your own.
  await run("123. buyer sets the seller's read time -> Deny", async () => {
    await assertFails(updateDoc(doc(asBuyer(), CONV), { sellerReadAt: serverTimestamp() }));
  });
  await run("124. seller marks the chat read -> Allow", async () => {
    await assertSucceeds(updateDoc(doc(asSeller(), CONV), { sellerReadAt: serverTimestamp() }));
  });

  // 125-126. Messages are never edited or deleted.
  await run("125. edit a text message -> Deny", async () => {
    await assertFails(updateDoc(doc(asBuyer(), `${CONV}/messages/m1`), { text: "changed" }));
  });
  await run("126. delete a message -> Deny", async () => {
    await assertFails(deleteDoc(doc(asBuyer(), `${CONV}/messages/m1`)));
  });

  // 127. Buyer proposes a meeting at a fixed spot in 2 days.
  await run("127. valid meeting proposal -> Allow", async () => {
    await assertSucceeds(setDoc(doc(asBuyer(), `${CONV}/messages/meet1`), meetingMsg("other-approved-user")));
  });

  // 128-130. Bad spot, past time, too far ahead.
  await run("128. meeting at an unknown spot -> Deny", async () => {
    await assertFails(setDoc(doc(asBuyer(), `${CONV}/messages/meetX1`),
      meetingMsg("other-approved-user", { spot: "my_house" })));
  });
  await run("129. meeting in the past -> Deny", async () => {
    await assertFails(setDoc(doc(asBuyer(), `${CONV}/messages/meetX2`),
      meetingMsg("other-approved-user", { meetAt: inDays(-1) })));
  });
  await run("130. meeting more than 60 days ahead -> Deny", async () => {
    await assertFails(setDoc(doc(asBuyer(), `${CONV}/messages/meetX3`),
      meetingMsg("other-approved-user", { meetAt: inDays(61) })));
  });

  // 131. Proposer accepts their own proposal.
  await run("131. proposer accepts own meeting -> Deny", async () => {
    await assertFails(updateDoc(doc(asBuyer(), `${CONV}/messages/meet1`),
      { status: "accepted", respondedAt: serverTimestamp() }));
  });

  // 132. Outsider answers the proposal.
  await run("132. outsider answers a meeting -> Deny", async () => {
    await assertFails(updateDoc(doc(asOutsider(), `${CONV}/messages/meet1`),
      { status: "declined", respondedAt: serverTimestamp() }));
  });

  // 133. The other person declines.
  await run("133. other participant declines -> Allow", async () => {
    await assertSucceeds(updateDoc(doc(asSeller(), `${CONV}/messages/meet1`),
      { status: "declined", respondedAt: serverTimestamp() }));
  });

  // 134. Changing a decided proposal.
  await run("134. change an already-decided meeting -> Deny", async () => {
    await assertFails(updateDoc(doc(asSeller(), `${CONV}/messages/meet1`),
      { status: "accepted", respondedAt: serverTimestamp() }));
  });

  // 135. Proposer cancels their own pending proposal.
  await run("135. proposer cancels own pending meeting -> Allow", async () => {
    await setDoc(doc(asBuyer(), `${CONV}/messages/meet2`), meetingMsg("other-approved-user"));
    await assertSucceeds(updateDoc(doc(asBuyer(), `${CONV}/messages/meet2`),
      { status: "cancelled", respondedAt: serverTimestamp() }));
  });

  // 136. Banned participant sends a message.
  await run("136. banned participant sends a message -> Deny", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "conversations/listing1_banned-user"), {
        ...convData({ buyerId: "banned-user", participants: ["banned-user", "approved-user"] }),
        createdAt: new Date(), updatedAt: new Date(),
      });
    });
    const db = testEnv.authenticatedContext("banned-user").firestore();
    await assertFails(setDoc(doc(db, "conversations/listing1_banned-user/messages/b1"), textMsg("banned-user")));
  });

  // 137. Public profile with department + memberSince.
  await run("137. publicProfiles with department + memberSince -> Allow", async () => {
    await assertSucceeds(setDoc(doc(asSeller(), "publicProfiles/approved-user"), {
      name: "Test", photo: "", updatedAt: new Date(), department: "Computer Science", memberSince: new Date(),
    }));
  });

  // 138. Public profile leaking a private field.
  await run("138. publicProfiles with an email field -> Deny", async () => {
    await assertFails(setDoc(doc(asSeller(), "publicProfiles/approved-user"), {
      name: "Test", photo: "", updatedAt: new Date(), email: "x@y.z",
    }));
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
