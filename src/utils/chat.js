import { collection, doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "../services/firebase";

// Chat (stage 15). One conversation per item + buyer; firestore.rules checks
// every field below. See rules: match /conversations/{convId}.

export const MESSAGE_MAX = 1000;
const PREVIEW_MAX = 140;

// Firestore ids and Firebase uids never contain "_", so this is unambiguous.
export const convIdFor = (itemId, buyerUid) => `${itemId}_${buyerUid}`;

// Which "last read" field belongs to this user in this conversation.
export const readFieldFor = (conv, uid) => (conv?.buyerId === uid ? "buyerReadAt" : "sellerReadAt");

// Buyer taps "Message seller": reuse the chat if it exists, otherwise create it.
// item = { id, title, ownerId }, itemType = "listing" | "service".
export async function openConversation({ item, itemType, buyerUid }) {
  const id = convIdFor(item.id, buyerUid);
  const ref = doc(db, "conversations", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      itemType,
      itemId: item.id,
      itemTitle: String(item.title || "Untitled").slice(0, 200),
      buyerId: buyerUid,
      sellerId: item.ownerId,
      participants: [buyerUid, item.ownerId],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastMessage: "",
      lastSenderId: "",
    });
  }
  return id;
}

// Sends a text message and updates the inbox preview in ONE batch, so the
// preview never says something the thread doesn't contain.
export async function sendText({ conv, uid, text }) {
  const clean = text.trim().slice(0, MESSAGE_MAX);
  if (!clean) return;
  const convRef = doc(db, "conversations", conv.id);
  const msgRef = doc(collection(convRef, "messages"));
  const batch = writeBatch(db);
  batch.set(msgRef, { senderId: uid, type: "text", text: clean, createdAt: serverTimestamp() });
  batch.update(convRef, {
    lastMessage: clean.replace(/\s+/g, " ").slice(0, PREVIEW_MAX),
    lastSenderId: uid,
    updatedAt: serverTimestamp(),
    [readFieldFor(conv, uid)]: serverTimestamp(),
  });
  await batch.commit();
}

// "I've seen everything up to now."
export async function markConversationRead({ conv, uid }) {
  await updateDoc(doc(db, "conversations", conv.id), { [readFieldFor(conv, uid)]: serverTimestamp() });
}

// Is there something in this chat I haven't seen? (last message is from the
// other person and newer than my read time)
export function isConversationUnread(conv, uid) {
  if (!conv || !conv.lastSenderId || conv.lastSenderId === uid) return false;
  const readAt = conv[readFieldFor(conv, uid)]?.toDate?.();
  const updatedAt = conv.updatedAt?.toDate?.();
  if (!updatedAt) return false;
  return !readAt || updatedAt > readAt;
}

// Fixed public meeting spots — must match meetingSpots() in firestore.rules.
export const MEETING_SPOTS = [
  { key: "library", label: "Main Library entrance" },
  { key: "canteen", label: "Canteen" },
  { key: "student_union", label: "Student Union" },
  { key: "main_gate", label: "Main Gate" },
  { key: "sports_centre", label: "Sports Centre" },
];
export const spotLabel = (key) => MEETING_SPOTS.find((s) => s.key === key)?.label || "Campus";
