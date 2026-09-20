import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
const firebaseConfig = {
  apiKey: "AIzaSyDmN4MYWJ9OjXqAhC-RJ0Pr50d9e7squtM",
  authDomain: "campushub-c2df6.firebaseapp.com",
  projectId: "campushub-c2df6",
  storageBucket: "campushub-c2df6.firebasestorage.app",
  messagingSenderId: "1061916823369",
  appId: "1:1061916823369:web:5afa97136c6b1c6fd1d498",
  measurementId: "G-0MR4W18TDX",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);