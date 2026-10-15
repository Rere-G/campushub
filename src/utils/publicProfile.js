// Makes sure the signed-in user has a public {name, photo} mirror, so the
// listings and services they post show their real name instead of "Student".
// Profile.jsx writes this mirror on every profile save, but an account that
// never pressed Save has none; this fills the gap at the moment they post.
//
// It only ever writes the user's OWN publicProfiles doc (the only thing
// firestore.rules allows) and never overwrites a mirror that already has a
// name, so a name set on the Profile page always wins.
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../services/firebase";

export async function ensurePublicProfile(uid, authEmail = "") {
  const mirrorRef = doc(db, "publicProfiles", uid);
  const mirrorSnap = await getDoc(mirrorRef);
  if (mirrorSnap.exists() && (mirrorSnap.data().name || "").trim()) return;

  const userSnap = await getDoc(doc(db, "users", uid));
  const u = userSnap.exists() ? userSnap.data() : {};
  const emailName = (u.email || authEmail || "").split("@")[0];
  const name = (u.fullName || u.username || emailName || "").trim();
  if (!name) return;

  await setDoc(
    mirrorRef,
    { name, photo: u.profilePhoto || "", updatedAt: serverTimestamp() },
    { merge: true }
  );
}
