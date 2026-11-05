import { collection, deleteField, doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";
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

const toPreview = (t) => t.replace(/\s+/g, " ").slice(0, PREVIEW_MAX);

// Sends a text message and updates the inbox preview in ONE batch, so the
// preview never says something the thread doesn't contain.
// replyTo (optional): the message being answered { id, senderId, text }.
export async function sendText({ conv, uid, text, replyTo = null }) {
  const clean = text.trim().slice(0, MESSAGE_MAX);
  if (!clean) return;
  const convRef = doc(db, "conversations", conv.id);
  const msgRef = doc(collection(convRef, "messages"));
  const batch = writeBatch(db);
  const msg = { senderId: uid, type: "text", text: clean, createdAt: serverTimestamp() };
  if (replyTo) {
    msg.replyTo = {
      id: replyTo.id,
      senderId: replyTo.senderId,
      text: toPreview(replyTo.deleted ? "" : replyTo.text || ""),
    };
  }
  batch.set(msgRef, msg);
  batch.update(convRef, {
    lastMessage: toPreview(clean),
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

// Edits are allowed for 15 minutes after sending (firestore.rules, stage 15c).
export const EDIT_WINDOW_MS = 15 * 60 * 1000;
export const canEdit = (m, uid) =>
  m.type === "text" && m.senderId === uid && !m.deleted && !!m.at && Date.now() - m.at.getTime() < EDIT_WINDOW_MS;

// If the message I changed is the chat's latest (and mine), refresh ONLY the
// inbox preview text, so it never shows something that's been edited/deleted.
function previewFix(batch, conv, uid, isLatest, text) {
  if (isLatest && conv.lastSenderId === uid) {
    batch.update(doc(db, "conversations", conv.id), { lastMessage: toPreview(text) });
  }
}

export async function editMessage({ conv, uid, msg, text, isLatest }) {
  const clean = text.trim().slice(0, MESSAGE_MAX);
  if (!clean) return;
  const batch = writeBatch(db);
  batch.update(doc(db, "conversations", conv.id, "messages", msg.id), { text: clean, editedAt: serverTimestamp() });
  previewFix(batch, conv, uid, isLatest, clean);
  await batch.commit();
}

// "Delete for everyone": the text is erased; the bubble stays as a placeholder.
export async function deleteMessage({ conv, uid, msg, isLatest }) {
  const batch = writeBatch(db);
  batch.update(doc(db, "conversations", conv.id, "messages", msg.id), {
    text: "",
    deleted: true,
    deletedAt: serverTimestamp(),
  });
  previewFix(batch, conv, uid, isLatest, "This message was deleted");
  await batch.commit();
}

// Five reactions; each person has at most one per message.
export const REACTIONS = [
  { key: "like", emoji: "\u{1F44D}", label: "Like" },
  { key: "love", emoji: "\u2764\uFE0F", label: "Love" },
  { key: "laugh", emoji: "\u{1F602}", label: "Laugh" },
  { key: "wow", emoji: "\u{1F62E}", label: "Wow" },
  { key: "sad", emoji: "\u{1F622}", label: "Sad" },
];
export const reactionEmoji = (key) => REACTIONS.find((r) => r.key === key)?.emoji || "";

// Pick the same reaction again to remove it.
export async function setReaction({ convId, msgId, uid, current, next }) {
  const ref = doc(db, "conversations", convId, "messages", msgId);
  await updateDoc(ref, { [`reactions.${uid}`]: current === next ? deleteField() : next });
}

// Ready-made first messages, by role and item type.
export function quickMessages({ isBuyer, isListing }) {
  if (!isBuyer) {
    return isListing
      ? ["Yes, it's still available.", "Sorry, it's already sold.", "The price is fixed.", "When are you free to meet?"]
      : ["Yes, I'm available.", "Sorry, I'm fully booked right now.", "The price is fixed.", "When suits you?"];
  }
  return isListing
    ? ["Is this still available?", "Can we negotiate the price?", "Can you send more photos?", "When can we meet on campus?"]
    : ["Are you available this week?", "What's included in the price?", "How long does it usually take?", "Can we discuss the price?"];
}

// ---- Stage 15f: offers, typing ----
export const OFFER_MAX = 100000000;
export const formatKs = (n) => new Intl.NumberFormat("en-US").format(Number(n) || 0);

// A price offer in whole Kyat. Same batch pattern as sendText.
export async function sendOffer({ conv, uid, amount }) {
  const value = Math.round(Number(amount));
  if (!Number.isInteger(value) || value < 1 || value > OFFER_MAX) throw new Error("bad amount");
  const convRef = doc(db, "conversations", conv.id);
  const msgRef = doc(collection(convRef, "messages"));
  const batch = writeBatch(db);
  batch.set(msgRef, { senderId: uid, type: "offer", amount: value, status: "pending", createdAt: serverTimestamp() });
  batch.update(convRef, {
    lastMessage: `Offer: Ks ${formatKs(value)}`,
    lastSenderId: uid,
    updatedAt: serverTimestamp(),
    [readFieldFor(conv, uid)]: serverTimestamp(),
  });
  await batch.commit();
}

// Accept / decline (the other person) or cancel (the sender) a pending
// offer or meeting proposal. firestore.rules enforces who may do which.
export async function answerProposal({ convId, msgId, status }) {
  await updateDoc(doc(db, "conversations", convId, "messages", msgId), {
    status,
    respondedAt: serverTimestamp(),
  });
}

// "I'm typing" — the caller throttles this to once every few seconds.
export async function pingTyping({ convId, uid }) {
  await setDoc(doc(db, "conversations", convId, "typing", uid), { at: serverTimestamp() });
}
export const TYPING_PING_MS = 3000;
export const TYPING_SHOW_MS = 6000;

// ---- Stage 15g: meetup proposals ----
export const MEET_MAX_DAYS = 60;
export const meetWhenText = (d) =>
  d ? d.toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

// Propose meeting at one of the fixed public spots (firestore.rules checks the
// spot list and that the time is in the next 60 days).
export async function sendMeeting({ conv, uid, spot, meetAt }) {
  const convRef = doc(db, "conversations", conv.id);
  const msgRef = doc(collection(convRef, "messages"));
  const batch = writeBatch(db);
  batch.set(msgRef, { senderId: uid, type: "meeting", spot, meetAt, status: "pending", createdAt: serverTimestamp() });
  batch.update(convRef, {
    lastMessage: toPreview(`Meetup: ${spotLabel(spot)} · ${meetWhenText(meetAt)}`),
    lastSenderId: uid,
    updatedAt: serverTimestamp(),
    [readFieldFor(conv, uid)]: serverTimestamp(),
  });
  await batch.commit();
}
