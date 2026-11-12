import { createContext, useContext } from "react";

// Stage 18b: the app shell already listens to my conversations (for the
// unread badge). It shares that one live list through this context, so the
// Dashboard and Messages don't each open a second Firestore listener.
export const InboxContext = createContext(null);

const EMPTY = { convs: [], loading: false, error: false, unreadCount: 0 };
export const useInbox = () => useContext(InboxContext) || EMPTY;
