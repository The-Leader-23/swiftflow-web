'use client';
import { db } from '@/lib/firebase.client';
import { addDoc, collection } from 'firebase/firestore';

export default function TestFirestore() {
  const handleAdd = async () => {
    await addDoc(collection(db, 'test'), {
      timestamp: new Date(),
      message: 'Hello from Swift 👑'
    });
  };

  return <button onClick={handleAdd}>Add test doc</button>;
}
