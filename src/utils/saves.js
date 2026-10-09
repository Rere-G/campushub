// Shared "saved" (wishlist) read/write logic — works for both listings and
// services, so there's exactly one implementation of the save/unsave write
// path across Marketplace and (soon) Services.
import { doc, setDoc, deleteDoc, updateDoc, increment, serverTimestamp } from "firebase/firestore";
import { db } from "../services/firebase";

// Matches the firestore.rules id format exactly: "<uid>_<itemId>".
export const saveIdFor = (uid, itemId) => `${uid}_${itemId}`;

// Toggles one item's saved state and keeps users/{uid}.savedCount in step
// with it. itemType is "listing" or "service" — required by firestore.rules
// so a saved doc always says what kind of thing it's pointing at. Both
// writes are independent documents (no transaction needed — a mismatch here
// is a cosmetic stat, not a security concern), matching the increment()
// pattern already used elsewhere in the app.
export async function toggleSave({ uid, itemId, itemType, currentlySaved }) {
  const saveRef = doc(db, "saves", saveIdFor(uid, itemId));
  const userRef = doc(db, "users", uid);

  if (currentlySaved) {
    await deleteDoc(saveRef);
    await updateDoc(userRef, { savedCount: increment(-1) });
  } else {
    await setDoc(saveRef, { uid, itemId, itemType, createdAt: serverTimestamp() });
    await updateDoc(userRef, { savedCount: increment(1) });
  }
}
