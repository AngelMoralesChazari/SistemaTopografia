import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { getFirebaseStorage } from './firebase';

/**
 * Sube una imagen (Blob, File o Buffer) a Firebase Storage bajo la ruta de equipos.
 * Retorna la URL pública de descarga (download URL).
 */
export async function uploadEquipmentPhoto(
  equipmentId: string,
  data: Blob | Uint8Array | ArrayBuffer,
  fileName?: string
): Promise<string> {
  const storage = getFirebaseStorage();
  const ext = fileName ? fileName.split('.').pop()?.toLowerCase() || 'jpg' : 'jpg';
  const cleanExt = ext === 'jpeg' ? 'jpg' : ext;
  const path = `equipment/${equipmentId || 'general'}/photo_${Date.now()}.${cleanExt}`;
  const storageRef = ref(storage, path);

  const contentType =
    cleanExt === 'png'
      ? 'image/png'
      : cleanExt === 'webp'
        ? 'image/webp'
        : 'image/jpeg';

  const snapshot = await uploadBytes(storageRef, data, {
    contentType,
  });

  return await getDownloadURL(snapshot.ref);
}

/**
 * Elimina una foto previa de Firebase Storage a partir de su URL pública.
 * No arroja error si la foto ya no existe o es una URL externa.
 */
export async function deleteEquipmentPhotoByUrl(photoUrl: string): Promise<void> {
  if (!photoUrl || !photoUrl.includes('firebasestorage')) return;
  try {
    const storage = getFirebaseStorage();
    const storageRef = ref(storage, photoUrl);
    await deleteObject(storageRef);
  } catch (err) {
    // Si la imagen ya fue eliminada o no se encuentra, registramos advertencia sin bloquear la app
    console.warn('No se pudo eliminar la imagen de Firebase Storage:', err);
  }
}
