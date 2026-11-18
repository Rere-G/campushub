// Stage 21a: removes ALL CampusHub demo data (everything whose ID starts with "demo").
//
//   npm run unseed:demo -- --key "C:\path\to\key.json"          (dry run: lists what would go)
//   npm run unseed:demo -- --key "C:\path\to\key.json" --yes    (deletes it)
//
// Also removes real users' saves, reports and notifications that point at demo items,
// and chats about demo items. Real admins' audit-log entries about demo items are KEPT:
// the audit log is a permanent record. Photos stay on Cloudinary (unsigned uploads
// can't be deleted from a script); delete them in the Cloudinary console if you want.
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldPath } from "firebase-admin/firestore";
import { PROJECT_ID, USERS } from "./data.mjs";

const keyArg = process.argv.find((a) => a.startsWith("--key="))?.slice(6)
  ?? process.argv[process.argv.indexOf("--key") + 1];
const keyPath = keyArg && !keyArg.startsWith("--") ? resolve(keyArg) : process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!keyPath || !existsSync(keyPath)) {
  console.error('Admin key not found. Run:  npm run unseed:demo -- --key "C:\\path\\to\\key.json" [--yes]');
  process.exit(1);
}
const key = JSON.parse(readFileSync(keyPath, "utf8"));
if (key.project_id !== PROJECT_ID) {
  console.error(`Stop: this key is for project "${key.project_id}", not "${PROJECT_ID}".`);
  process.exit(1);
}
const really = process.argv.includes("--yes");

initializeApp({ credential: cert(key), projectId: PROJECT_ID });
const auth = getAuth();
const db = getFirestore();

// "demo" <= id < "demp" : every ID that starts with "demo".
const idRange = (col) => db.collection(col).where(FieldPath.documentId(), ">=", "demo").where(FieldPath.documentId(), "<", "demp");
const fieldRange = (col, field) => db.collection(col).where(field, ">=", "demo").where(field, "<", "demp");

const targets = new Map(); // path -> ref (deduplicated)
const add = (snap) => snap.docs.forEach((d) => targets.set(d.ref.path, d.ref));

for (const col of ["users", "publicProfiles", "listings", "services", "saves", "reports", "notifications", "conversations", "adminLog"]) {
  add(await idRange(col).get());
}
add(await fieldRange("saves", "itemId").get());          // real users' saves of demo items
add(await fieldRange("reports", "itemId").get());        // real users' reports on demo items
add(await fieldRange("notifications", "itemId").get());  // notifications about demo items
add(await fieldRange("conversations", "itemId").get());  // chats about demo items
const ann = await db.doc("announcements/current").get();
if (ann.exists && ann.data().updatedBy === "demoAdmin") targets.set(ann.ref.path, ann.ref);

const byCollection = {};
for (const path of targets.keys()) {
  const col = path.split("/")[0];
  byCollection[col] = (byCollection[col] || 0) + 1;
}
const demoUids = [];
for (const u of USERS) {
  try { await auth.getUser(u.uid); demoUids.push(u.uid); } catch { /* already gone */ }
}

console.log(`${really ? "Deleting" : "Would delete"} from ${PROJECT_ID}:`);
for (const [col, n] of Object.entries(byCollection).sort()) console.log(`  ${col.padEnd(15)} ${n} document(s) (+ their comments/messages)`);
console.log(`  auth accounts   ${demoUids.length} (${demoUids.join(", ") || "none"})`);

if (!really) {
  console.log("\nDry run only. Add --yes to delete.");
  process.exit(0);
}
for (const ref of targets.values()) {
  await db.recursiveDelete(ref); // also removes comments / messages / typing under it
}
if (demoUids.length) await auth.deleteUsers(demoUids);
console.log("\nDone. Demo data removed. Cloudinary photos were left in place.");
process.exit(0);
