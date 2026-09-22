/**
 * Utilidades para optimizar imágenes en cliente antes de subirlas a Firebase Storage.
 * Redimensiona proporcionalmente manteniendo la relación de aspecto y aplica
 * compresión JPEG de alta calidad para optimizar tiempo de carga y almacenamiento.
 */

export type OptimizedImageResult = {
  blob: Blob;
  width: number;
  height: number;
  originalSize: number;
  optimizedSize: number;
  reductionPercentage: number;
};

export type OptimizeImageOptions = {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0 a 1
};

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Procesa un archivo de imagen en el navegador usando HTML5 Canvas:
 * 1. Calcula las nuevas dimensiones proporcionales sin exceder maxWidth ni maxHeight.
 * 2. Dibuja en canvas con interpolación de alta calidad.
 * 3. Exporta a Blob JPEG con el factor de calidad deseado.
 */
export async function optimizeImageForUpload(
  file: File | Blob,
  options: OptimizeImageOptions = {}
): Promise<OptimizedImageResult> {
  const {
    maxWidth = 1000,
    maxHeight = 1000,
    quality = 0.82,
  } = options;

  return new Promise((resolve, reject) => {
    // Si no estamos en entorno con window o document (SSR)
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      resolve({
        blob: file,
        width: 0,
        height: 0,
        originalSize: file.size,
        optimizedSize: file.size,
        reductionPercentage: 0,
      });
      return;
    }

    const img = new window.Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const originalWidth = img.naturalWidth || img.width;
      const originalHeight = img.naturalHeight || img.height;

      if (!originalWidth || !originalHeight) {
        reject(new Error('No se pudieron obtener las dimensiones de la imagen.'));
        return;
      }

      // Proporción manteniendo relación de aspecto
      const ratio = Math.min(maxWidth / originalWidth, maxHeight / originalHeight, 1);
      const targetWidth = Math.max(1, Math.round(originalWidth * ratio));
      const targetHeight = Math.max(1, Math.round(originalHeight * ratio));

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('El navegador no soporta el contexto 2D de lienzo.'));
        return;
      }

      // Algoritmo de suavizado para máxima nitidez
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('No se pudo comprimir la imagen en el lienzo.'));
            return;
          }

          const originalSize = file.size;
          const optimizedSize = blob.size;
          const diff = Math.max(0, originalSize - optimizedSize);
          const reduction = originalSize > 0 ? Math.round((diff / originalSize) * 100) : 0;

          resolve({
            blob,
            width: targetWidth,
            height: targetHeight,
            originalSize,
            optimizedSize,
            reductionPercentage: reduction,
          });
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('El archivo seleccionado no es una imagen válida o está dañado.'));
    };

    img.src = objectUrl;
  });
}
