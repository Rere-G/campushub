// Stage 21a follow-up: attaches photos to the seeded demo listings/services.
// Unsplash now answers scripts with a bot check, so seed.mjs can't download its photos.
// These come from Pexels instead (free to use under the Pexels licence,
// https://www.pexels.com/license/), each checked by eye to match its item.
//
//   node scripts/demo/attach-photos.mjs --check                          (download test only)
//   node scripts/demo/attach-photos.mjs --key "C:\path\outside\the\project\key.json"
//
// Each photo is uploaded to Cloudinary (same unsigned preset as the app) and set as
// the item's only photo. Items that already have a photo are skipped unless --force.
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { PROJECT_ID } from "./data.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLOUD_NAME = "jrwzbtls";                       // same as CreateListing.jsx
const UPLOAD_PRESET = "campushub_listings_unsigned";   // same as CreateListing.jsx

// item path -> Pexels photo (page: https://www.pexels.com/photo/<slug>-<id>/)
const PHOTOS = {
  "listings/demoL01": { id: 220301, slug: "scientific-calculator-on-wooden-surface" },
  "listings/demoL02": { id: 5239563, slug: "stack-of-textbooks-on-wooden-table" },
  "listings/demoL03": { id: 2582938, slug: "turned-on-mechanical-keyboard" },
  "listings/demoL04": { id: 7193653, slug: "adjustable-desk-lamp-on-a-wooden-stool" },
  "listings/demoL05": { id: 3945667, slug: "black-wireless-headphones-on-white-surface" },
  "listings/demoL06": { id: 34944601, slug: "sunburst-acoustic-guitar-in-soft-light" },
  "listings/demoL08": { id: 8442640, slug: "a-woman-in-lab-gown" },
  "listings/demoL09": { id: 4577650, slug: "books-and-lamp-on-bedside-table-in-hotel-room" },
  "listings/demoL10": { id: 17764927, slug: "a-computer-keyboard-on-yellow-background" },
  "listings/demoL11": { id: 34652531, slug: "cozy-sunlit-reading-nook-with-armchair" },
  "listings/demoL13": { id: 6683394, slug: "test-papers-and-pencil-on-the-desk" },
  "listings/demoL14": { id: 9594667, slug: "hoodie-sweaters-hanged-on-a-clothes-rack" },
  "listings/demoL15": { id: 16311110, slug: "game-controller-on-black-background" },
  "services/demoS01": { id: 6325966, slug: "photo-of-man-teaching-via-smartphone" },
  "services/demoS02": { id: 7639370, slug: "a-man-fixing-a-laptop" },
  "services/demoS03": { id: 8546649, slug: "close-up-of-sketches-in-a-notepad-lying-on-a-desk" },
  "services/demoS07": { id: 8554325, slug: "two-people-talking-at-a-cafe-table" },
};

async function download(id) {
  const url = `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1200`;
  const res = await fetch(url);
  if (!res.ok || !String(res.headers.get("content-type")).startsWith("image/")) throw new Error(`download ${res.status}`);
  return new Blob([await res.arrayBuffer()], { type: "image/jpeg" });
}

// ---------- --check: download test, no key, nothing written ----------
if (process.argv.includes("--check")) {
  let ok = 0;
  for (const [path, p] of Object.entries(PHOTOS)) {
    try { const b = await download(p.id); ok += 1; console.log(`  ✓ ${path}  ${p.id}  ${Math.round(b.size / 1024)} KB`); }
    catch (err) { console.warn(`  ! ${path}  ${p.id}: ${err.message}`); }
  }
  console.log(`\n${ok}/${Object.keys(PHOTOS).length} photos downloadable.`);
  process.exit(ok === Object.keys(PHOTOS).length ? 0 : 1);
}

// ---------- key file (same checks as seed.mjs) ----------
const keyArg = process.argv.find((a) => a.startsWith("--key="))?.slice(6)
  ?? process.argv[process.argv.indexOf("--key") + 1];
const keyPath = keyArg && !keyArg.startsWith("--") ? resolve(keyArg) : process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!keyPath || !existsSync(keyPath)) {
  console.error('Admin key not found. Run:  node scripts/demo/attach-photos.mjs --key "C:\\path\\to\\key.json"');
  process.exit(1);
}
const rel = relative(ROOT, keyPath);
if (!rel.startsWith("..") && !isAbsolute(rel)) {
  console.error("Stop: the admin key is inside the project folder, where it could be committed.");
  process.exit(1);
}
const key = JSON.parse(readFileSync(keyPath, "utf8"));
if (key.project_id !== PROJECT_ID) {
  console.error(`Stop: this key is for project "${key.project_id}", not "${PROJECT_ID}".`);
  process.exit(1);
}
const force = process.argv.includes("--force");

const { initializeApp, cert } = await import("firebase-admin/app");
const { getFirestore } = await import("firebase-admin/firestore");
initializeApp({ credential: cert(key), projectId: PROJECT_ID });
const db = getFirestore();

async function upload(blob, id) {
  const fd = new FormData();
  fd.append("file", blob, `pexels-${id}.jpg`);
  fd.append("upload_preset", UPLOAD_PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body: fd });
  const json = await res.json();
  if (!res.ok || !json.secure_url) throw new Error(json?.error?.message || `upload ${res.status}`);
  return json.secure_url;
}

let done = 0;
for (const [path, p] of Object.entries(PHOTOS)) {
  try {
    const ref = db.doc(path);
    const snap = await ref.get();
    if (!snap.exists) throw new Error("item not found (seed first)");
    if (!force && snap.data().photos?.length) { console.log(`  - ${path} already has a photo`); continue; }
    const url = await upload(await download(p.id), p.id);
    await ref.update({ photos: [url] });
    done += 1;
    console.log(`  ✓ ${path}  ${snap.data().title}`);
  } catch (err) {
    console.warn(`  ! ${path}: ${err.message}`);
  }
}
console.log(`\nDone: ${done}/${Object.keys(PHOTOS).length} photos attached.`);
process.exit(0);
