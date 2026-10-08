// Shared "saved listing" (wishlist) read/write logic, used by both the
// Marketplace card grid and the ListingDetail page so there's exactly one
// implementation of the save/unsave write path.
import { doc, setDoc, deleteDoc, updateDoc, increment, serverTimestamp } from "firebase/firestore";
import { db } from "../services/firebase";

// Matches the firestore.rules id format exactly: "<uid>_<listingId>".
export const saveIdFor = (uid, listingId) => `${uid}_${listingId}`;

// Toggles one listing's saved state and keeps users/{uid}.savedCount in
// step with it. Both writes are independent documents (no transaction
// needed — a mismatch here is a cosmetic stat, not a security concern),
// matching the increment() pattern already used elsewhere in the app.
export async function toggleSave({ uid, listingId, currentlySaved }) {
  const saveRef = doc(db, "saves", saveIdFor(uid, listingId));
  const userRef = doc(db, "users", uid);

  if (currentlySaved) {
    await deleteDoc(saveRef);
    await updateDoc(userRef, { savedCount: increment(-1) });
  } else {
    await setDoc(saveRef, { uid, listingId, createdAt: serverTimestamp() });
    await updateDoc(userRef, { savedCount: increment(1) });
  }
}
