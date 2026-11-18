// Stage 21a: creates CampusHub's demo accounts and demo content in the LIVE project.
//
//   npm run seed:demo -- --key "C:\path\outside\the\project\campushub-admin-key.json"
//
// - Uses the Firebase Admin SDK, so firestore.rules don't apply; every document is
//   written in exactly the shape the app writes it, so the app can edit it later.
// - Every ID starts with "demo"; `npm run unseed:demo` removes all of it.
// - Writes the demo logins to demo-accounts.txt (git-ignored). Never commit that file
//   or the admin key.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import {
  PROJECT_ID, CAMPUS, USERS, PHOTOS, LISTINGS, SERVICES, COMMENTS, SAVES, CHATS,
  REPORTS, NOTIFICATIONS, ADMIN_LOG, ANNOUNCEMENT,
} from "./data.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLOUD_NAME = "jrwzbtls";                       // same as CreateListing.jsx
const UPLOAD_PRESET = "campushub_listings_unsigned";   // same as CreateListing.jsx

// ---------- key file ----------
const keyArg = process.argv.find((a) => a.startsWith("--key="))?.slice(6)
  ?? process.argv[process.argv.indexOf("--key") + 1];
const keyPath = keyArg && !keyArg.startsWith("--") ? resolve(keyArg) : process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!keyPath || !existsSync(keyPath)) {
  console.error('Admin key not found. Run:  npm run seed:demo -- --key "C:\\path\\to\\key.json"');
  process.exit(1);
}
const rel = relative(ROOT, keyPath);
if (!rel.startsWith("..") && !isAbsolute(rel)) {
  console.error("Stop: the admin key is inside the project folder, where it could be committed.\nMove it outside the project (e.g. to Downloads) and run again.");
  process.exit(1);
}
const key = JSON.parse(readFileSync(keyPath, "utf8"));
if (key.project_id !== PROJECT_ID) {
  console.error(`Stop: this key is for project "${key.project_id}", not "${PROJECT_ID}".`);
  process.exit(1);
}

initializeApp({ credential: cert(key), projectId: PROJECT_ID });
const auth = getAuth();
const db = getFirestore();

// ---------- helpers ----------
const NOW = Date.now();
const ago = (days) => new Date(NOW - days * 86400000);
const ts = (days) => Timestamp.fromDate(ago(days));
const tsH = (hours) => Timestamp.fromDate(new Date(NOW - hours * 3600000));
const password = () => "Demo-" + randomBytes(9).toString("base64url");
const userById = Object.fromEntries(USERS.map((u) => [u.uid, u]));
const nameOf = (uid) => userById[uid]?.fullName || "Student";
const SPOT_LABELS = { library: "Main Library entrance", canteen: "Canteen", student_union: "Student Union", main_gate: "Main Gate", sports_centre: "Sports Centre" };
const money = (n, cur) => (cur === "USD" ? "$" : "Ks ") + new Intl.NumberFormat("en-US").format(n);

async function uploadPhoto(pageUrl) {
  const id = pageUrl.slice(-11); // Unsplash photo IDs are the last 11 characters of the page URL
  try {
    // Unsplash's official download link (counts the download for the photographer).
    let res = await fetch(`https://unsplash.com/photos/${id}/download?force=true`, { redirect: "manual" });
    let imageUrl = res.headers.get("location");
    if (imageUrl) {
      const u = new URL(imageUrl);
      u.searchParams.set("w", "1200"); u.searchParams.set("q", "80"); u.searchParams.set("fm", "jpg");
      res = await fetch(u);
    } else {
      res = await fetch(`https://unsplash.com/photos/${id}/download?force=true`);
    }
    if (!res.ok || !String(res.headers.get("content-type")).startsWith("image/")) throw new Error(`download ${res.status}`);
    const blob = new Blob([await res.arrayBuffer()], { type: "image/jpeg" });
    const fd = new FormData();
    fd.append("file", blob, `${id}.jpg`);
    fd.append("upload_preset", UPLOAD_PRESET);
    const up = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body: fd });
    const json = await up.json();
    if (!up.ok || !json.secure_url) throw new Error(json?.error?.message || `upload ${up.status}`);
    return json.secure_url;
  } catch (err) {
    console.warn(`  ! photo skipped (${id}): ${err.message}`);
    return null;
  }
}

// ---------- refuse to run twice ----------
try {
  await auth.getUser("demoAdmin");
  console.error("Demo data already exists. Run `npm run unseed:demo -- --key ... --yes` first if you want to recreate it.");
  process.exit(1);
} catch (err) {
  if (err.code !== "auth/user-not-found") throw err;
}
const ann = await db.doc("announcements/current").get();
const keepRealAnnouncement = ann.exists && ann.data().updatedBy !== "demoAdmin";

console.log(`Seeding demo data into ${PROJECT_ID} …`);

// ---------- 1. photos ----------
console.log("1/4 Uploading photos to Cloudinary …");
const photoUrl = {};
for (const [name, page] of Object.entries(PHOTOS)) {
  photoUrl[name] = await uploadPhoto(page);
  if (photoUrl[name]) console.log(`  ✓ ${name}`);
}

// ---------- 2. accounts ----------
console.log("2/4 Creating accounts …");
const logins = [];
for (const u of USERS) {
  const pw = password();
  await auth.createUser({ uid: u.uid, email: u.email, password: pw, displayName: u.fullName, emailVerified: true });
  logins.push({ ...u, password: pw });
  console.log(`  ✓ ${u.fullName} (${u.role}${u.banned ? ", banned" : u.approved ? "" : ", pending"})`);
}

// ---------- 3. documents ----------
console.log("3/4 Writing documents …");
let batch = db.batch(); let ops = 0;
const set = async (ref, data) => {
  batch.set(ref, data); ops += 1;
  if (ops >= 400) { await batch.commit(); batch = db.batch(); ops = 0; }
};

const counts = Object.fromEntries(USERS.map((u) => [u.uid, { listingsCount: 0, servicesCount: 0, savedCount: 0 }]));
LISTINGS.forEach((l) => (counts[l.seller].listingsCount += 1));
SERVICES.forEach((s) => (counts[s.provider].servicesCount += 1));
SAVES.forEach((s) => (counts[s.uid].savedCount += 1));

for (const u of USERS) {
  const complete = !!(u.fullName && u.department && u.studentId && u.graduationYear !== undefined);
  await set(db.doc(`users/${u.uid}`), {
    username: u.username, email: u.email,
    approved: u.approved, profileCompleted: complete && !!u.studentId, verificationStatus: "incomplete",
    fullName: u.fullName, university: CAMPUS, studentId: u.studentId, department: u.department,
    graduationYear: u.graduationYear, bio: u.bio, profilePhoto: "",
    ...counts[u.uid],
    role: u.role,
    ...(u.banned ? { banned: true } : {}),
    createdAt: ago(u.joinedDaysAgo).toISOString(), // the app stores this one as an ISO string
  });
  await set(db.doc(`publicProfiles/${u.uid}`), {
    name: u.fullName, photo: "", department: u.department.slice(0, 80),
    memberSince: Timestamp.fromDate(ago(u.joinedDaysAgo)), updatedAt: Timestamp.fromDate(ago(u.joinedDaysAgo)),
  });
}

for (const l of LISTINGS) {
  const url = l.photo ? photoUrl[l.photo] : null;
  await set(db.doc(`listings/${l.id}`), {
    sellerId: l.seller, title: l.title, description: l.description, price: l.price, currency: l.currency,
    condition: l.condition, meetupSpot: l.meetupSpot, negotiable: l.negotiable, category: l.category,
    photos: url ? [url] : [], status: l.status || "active", createdAt: ts(l.daysAgo),
    ...(l.status === "removed" || l.removedByAdmin ? { removedByAdmin: !!l.removedByAdmin } : {}),
  });
}
for (const s of SERVICES) {
  await set(db.doc(`services/${s.id}`), {
    providerId: s.provider, title: s.title, description: s.description, price: s.price, currency: s.currency,
    meetupSpot: s.meetupSpot, negotiable: s.negotiable, category: s.category,
    photos: [], status: s.status || "active", createdAt: ts(s.daysAgo),
  });
}
const ownerOf = (col, id) =>
  col === "listings" ? LISTINGS.find((l) => l.id === id).seller : SERVICES.find((s) => s.id === id).provider;
for (const c of COMMENTS) {
  const [col, id] = c.on;
  await set(db.doc(`${col}/${id}/comments/${c.id}`), {
    authorId: c.author, itemOwnerId: ownerOf(col, id), text: c.text, createdAt: tsH(c.hoursAgo),
  });
}
for (const s of SAVES) {
  await set(db.doc(`saves/${s.uid}_${s.itemId}`), { uid: s.uid, itemId: s.itemId, itemType: s.itemType, createdAt: ts(s.daysAgo) });
}

for (const chat of CHATS) {
  const col = chat.itemType === "listing" ? "listings" : "services";
  const item = (col === "listings" ? LISTINGS : SERVICES).find((x) => x.id === chat.item);
  const seller = ownerOf(col, chat.item);
  const convId = `${chat.item}_${chat.buyer}`;
  const convRef = db.doc(`conversations/${convId}`);
  let last = null;
  for (const m of chat.messages) {
    const sender = m.by === "buyer" ? chat.buyer : seller;
    const base = { senderId: sender, createdAt: tsH(m.hoursAgo) };
    let msg; let preview;
    if (m.type === "text") {
      msg = { ...base, type: "text", text: m.text, ...(m.reactions ? { reactions: m.reactions } : {}) };
      preview = m.text;
    } else if (m.type === "offer") {
      msg = { ...base, type: "offer", amount: m.amount, status: m.status,
        ...(m.status !== "pending" ? { respondedAt: tsH(m.respondedHoursAgo) } : {}) };
      preview = `Offer: ${money(m.amount, item.currency)}`;
    } else {
      const when = new Date(NOW + m.meetInDays * 86400000); when.setHours(m.meetHour, 0, 0, 0);
      msg = { ...base, type: "meeting", spot: m.spot, meetAt: Timestamp.fromDate(when), status: m.status };
      preview = `Meetup: ${SPOT_LABELS[m.spot]} · ${when.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`;
    }
    await set(convRef.collection("messages").doc(m.id), msg);
    last = { sender, at: tsH(m.hoursAgo), preview: preview.replace(/\s+/g, " ").slice(0, 140) };
  }
  const first = chat.messages[0];
  await set(convRef, {
    itemType: chat.itemType, itemId: chat.item, itemTitle: item.title.slice(0, 200),
    buyerId: chat.buyer, sellerId: seller, participants: [chat.buyer, seller],
    createdAt: tsH(first.hoursAgo + 0.01), updatedAt: last.at,
    lastMessage: last.preview, lastSenderId: last.sender,
    buyerReadAt: last.sender === chat.buyer ? last.at : tsH(0.5),
    ...(chat.sellerRead ? { sellerReadAt: tsH(0.5) } : { sellerReadAt: tsH(first.hoursAgo) }),
  });
}

for (const r of REPORTS) {
  await set(db.doc(`reports/${r.reporter}_${r.item}`), {
    reporterId: r.reporter, targetType: r.itemType, itemType: r.itemType, itemId: r.item, commentId: "",
    targetOwnerId: r.owner, reason: r.reason, note: r.note, status: r.status, createdAt: ts(r.daysAgo),
    ...(r.status !== "open" ? { action: r.action, resolvedBy: "demoAdmin", resolvedAt: ts(r.resolvedDaysAgo) } : {}),
  });
}
for (const n of NOTIFICATIONS) {
  const { id, daysAgo, ...data } = n;
  await set(db.doc(`notifications/${id}`), { ...data, createdAt: ts(daysAgo) });
}
for (const e of ADMIN_LOG) {
  await set(db.doc(`adminLog/${e.id}`), {
    actorId: "demoAdmin", action: e.action, targetType: e.targetType, targetId: e.targetId,
    targetLabel: e.targetLabel, reason: e.reason, createdAt: ts(e.daysAgo),
  });
}
if (!keepRealAnnouncement) {
  await set(db.doc("announcements/current"), {
    title: ANNOUNCEMENT.title, body: ANNOUNCEMENT.body, active: true,
    updatedAt: ts(ANNOUNCEMENT.daysAgo), updatedBy: "demoAdmin",
  });
}
await batch.commit();

// ---------- 4. logins file ----------
console.log("4/4 Saving demo logins …");
const lines = [
  "CampusHub demo accounts (FICTIONAL). Give these to markers privately; never commit this file.",
  `Live site: https://${PROJECT_ID}.web.app`, "",
  ...logins.map((u) => `${u.fullName.padEnd(13)} ${(u.role === "admin" ? "admin" : u.banned ? "banned student" : u.approved ? "approved student" : "pending student").padEnd(17)} ${u.email.padEnd(35)} ${u.password}`),
  "", `Created ${new Date().toISOString()}. Remove everything with: npm run unseed:demo -- --key <key.json> --yes`,
];
writeFileSync(resolve(ROOT, "demo-accounts.txt"), lines.join("\n") + "\n");

const photosOk = Object.values(photoUrl).filter(Boolean).length;
console.log(`\nDone: ${USERS.length} accounts, ${LISTINGS.length} listings, ${SERVICES.length} services, ${CHATS.length} chats, ${REPORTS.length} reports, ${photosOk}/${Object.keys(PHOTOS).length} photos.`);
if (keepRealAnnouncement) console.log("Your existing announcement was kept (not replaced by the demo one).");
console.log("Logins saved to demo-accounts.txt (git-ignored). Now delete or move the admin key somewhere safe.");
process.exit(0);
