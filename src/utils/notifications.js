import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../services/firebase";

// System notifications to one student (firestore.rules: admins create them,
// each with an exact shape; students can only list their own).
// Each helper is "best effort": the admin action already succeeded, so a
// failed notification is logged, never thrown.

export const REMOVAL_REASONS = [
  { key: "scam", label: "Scam" },
  { key: "prohibited", label: "Prohibited" },
  { key: "offensive", label: "Offensive" },
  { key: "spam", label: "Spam" },
  { key: "other", label: "Other" },
];

export const removalReasonText = (key) =>
  ({
    scam: "it looked like a scam",
    prohibited: "it isn't allowed on CampusHub",
    offensive: "it was offensive or abusive",
    spam: "it was spam",
    other: "it broke the CampusHub rules",
  })[key] || "it broke the CampusHub rules";

const title200 = (t) => String(t || "Untitled").slice(0, 200);

async function send(data) {
  try {
    await addDoc(collection(db, "notifications"), { ...data, createdAt: serverTimestamp() });
  } catch (err) {
    console.error("Couldn't send notification:", data.type, err);
  }
}

export const notifyPostRemoved = ({ uid, itemType, itemId, itemTitle, reason }) =>
  send({
    uid,
    type: "post_removed",
    itemType: itemType === "service" ? "service" : "listing",
    itemId,
    itemTitle: title200(itemTitle),
    reason: REMOVAL_REASONS.some((r) => r.key === reason) ? reason : "other",
  });

export const notifyAccountApproved = (uid) => send({ uid, type: "account_approved" });

// outcome: "removed" | "dismissed" | "banned"
export const notifyReportHandled = ({ uid, itemType, itemId, itemTitle, outcome }) =>
  send({
    uid,
    type: "report_handled",
    itemType: itemType === "service" ? "service" : "listing",
    itemId,
    itemTitle: title200(itemTitle),
    outcome,
  });
