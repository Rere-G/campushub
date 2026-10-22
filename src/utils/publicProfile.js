// Makes sure the signed-in user has a public mirror — {name, photo,
// department, memberSince} — so listings, services and chats show their real
// name (not "Student") and the chat header can show department / member since.
// Profile.jsx writes this mirror on every profile save, but an account that
// never pressed Save has none; this fills the gap when they post, comment or chat.
//
// It only ever writes the user's OWN publicProfiles doc (the only thing
// firestore.rules allows), never overwrites a name that's already set (a name
// set on the Profile page always wins), and only fills fields that are missing.
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../services/firebase";

// When the Firebase account was created (self-reported, like the rest of the profile).
export const memberSinceFor = (authUser) => {
  const t = authUser?.metadata?.creationTime;
  const d = t ? new Date(t) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};

export async function ensurePublicProfile(uid, authEmail = "") {
  const mirrorRef = doc(db, "publicProfiles", uid);
  const mirrorSnap = await getDoc(mirrorRef);
  const mirror = mirrorSnap.exists() ? mirrorSnap.data() : {};
  const hasName = (mirror.name || "").trim() !== "";
  if (hasName && "department" in mirror && mirror.memberSince) return;

  const userSnap = await getDoc(doc(db, "users", uid));
  const u = userSnap.exists() ? userSnap.data() : {};
  const patch = {};

  if (!hasName) {
    const emailName = (u.email || authEmail || "").split("@")[0];
    const name = (u.fullName || u.username || emailName || "").trim();
    if (!name) return;
    patch.name = name;
    patch.photo = u.profilePhoto || "";
  }
  if (!("department" in mirror)) patch.department = String(u.department || "").trim().slice(0, 80);
  if (!mirror.memberSince) {
    const since = auth.currentUser?.uid === uid ? memberSinceFor(auth.currentUser) : null;
    if (since) patch.memberSince = since;
  }
  if (Object.keys(patch).length === 0) return;

  await setDoc(mirrorRef, { ...patch, updatedAt: serverTimestamp() }, { merge: true });
}
