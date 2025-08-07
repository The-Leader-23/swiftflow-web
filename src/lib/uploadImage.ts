// src/lib/uploadImage.ts
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase.client';

export const uploadImage = async (file: File, userId: string): Promise<string> => {
  if (!file || !userId) throw new Error('Missing file or userId');

  const path = `products/${userId}/${file.name}`;
  const storageRef = ref(storage, path);
  const uploadTask = uploadBytesResumable(storageRef, file);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      null,
      (error) => reject(new Error('Upload failed: ' + error.message)),
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        resolve(downloadURL);
      }
    );
  });
};




