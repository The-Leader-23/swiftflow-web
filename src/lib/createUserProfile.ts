// 📁 /src/lib/createUserProfile.ts
import { doc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

export const createUserProfile = async (
  uid: string,
  email: string,
  role: "customer" | "entrepreneur"
) => {
  await setDoc(doc(db, "users", uid), {
    email,
    role,
    createdAt: new Date(),
  });
};
