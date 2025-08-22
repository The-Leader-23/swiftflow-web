import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase.client';

/**
 * Uploads a brand logo to Firebase Storage at logos/{userId}/{filename}
 * @param file - The logo file to upload
 * @param userId - The UID of the user
 * @returns The public download URL of the uploaded logo
 */
export const uploadLogo = async (file: File, userId: string): Promise<string> => {
  if (!file || !userId) {
    throw new Error('Missing file or userId');
  }

  // Ensure there's a filename so path matches rules (foldered path)
  const filename = file.name && file.name.trim().length > 0 ? file.name : 'logo.jpg';
  const logoRef = ref(storage, `logos/${userId}/${filename}`);

  const metadata = {
    contentType: file.type || 'image/jpeg',
  };

  const uploadTask = uploadBytesResumable(logoRef, file, metadata);

  return new Promise<string>((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        console.log(`🚀 Logo upload progress: ${progress.toFixed(0)}%`);
      },
      (error) => {
        console.error('❌ Logo upload error:', error);
        reject(error);
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          console.log('✅ Logo uploaded. URL:', downloadURL);
          resolve(downloadURL);
        } catch (err) {
          console.error('❌ Failed to get logo URL:', err);
          reject(err);
        }
      }
    );
  });
};

