import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { HiOutlineChatBubbleLeftRight } from "react-icons/hi2";
import { openConversation } from "../utils/chat";
import { ensurePublicProfile } from "../utils/publicProfile";

// "Message seller / provider" on a listing or service page. Opens the existing
// chat for this item, or starts one (firestore.rules checks the owner).
// Props: uid (me), item { id, title, ownerId }, itemType, ownerName, disabled
export default function MessageButton({ uid, item, itemType, ownerName, disabled = false }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const who = itemType === "listing" ? "seller" : "provider";
  const first = (ownerName || "").trim().split(" ")[0];

  const handleClick = async () => {
    if (!uid || busy || disabled) return;
    setBusy(true);
    setErr("");
    try {
      // So the other person sees my name, department and "member since".
      try {
        await ensurePublicProfile(uid);
      } catch (mirrorErr) {
        console.error("Couldn't sync publicProfiles:", mirrorErr);
      }
      const id = await openConversation({ item, itemType, buyerUid: uid });
      navigate(`/messages/${id}`);
    } catch (e) {
      console.error("Couldn't open chat:", e);
      setErr("Couldn't open the chat. Please try again.");
      setBusy(false);
    }
  };

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy || disabled}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#8f774b] to-[#c9963f] px-5 text-sm font-bold uppercase tracking-[0.06em] text-[#f4e6cd] shadow-[0_8px_24px_rgba(143,119,75,0.3)] transition-all duration-200 hover:-translate-y-0.5 hover:from-[#9c8352] hover:to-[#d6a24a] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
      >
        <HiOutlineChatBubbleLeftRight className="h-4 w-4" />
        {busy ? "Opening…" : first ? `Message ${first}` : `Message ${who}`}
      </button>
      {disabled && (
        <p className="mt-2 text-xs text-[#f4e6cd]/45">This {itemType} isn't available, so new chats are closed.</p>
      )}
      {err && <p className="mt-2 text-xs text-red-300">{err}</p>}
    </div>
  );
}
