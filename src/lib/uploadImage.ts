import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';

/**
 * Uploads a file to Firebase Storage inside the `products/{userId}` folder
 * @param file - image or file to upload
 * @param userId - UID of the current user
 * @returns download URL of the uploaded image
 */
export const uploadImage = async (file: File, userId: string): Promise<string> => {
  try {
    if (!file || !userId) throw new Error('Missing file or userId');

    console.log('📤 Uploading image:', file.name);

    const fileRef = ref(storage, `products/${userId}/${file.name}`);
    const metadata = {
      contentType: file.type || 'image/jpeg',
    };

    const uploadTask = uploadBytesResumable(fileRef, file, metadata);

    await new Promise<void>((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          console.log('⬆️ Upload progress:', (snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        },
        (error) => {
          console.error('❌ Upload error:', error);
          reject(error);
        },
        () => {
          console.log('✅ Upload complete');
          resolve();
        }
      );
    });

    const url = await getDownloadURL(fileRef);
    console.log('🌐 Download URL:', url);

    return url;
  } catch (err) {
    console.error('🔥 Upload failed:', err);
    throw err;
  }
};


