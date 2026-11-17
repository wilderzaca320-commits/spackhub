/**
 * Utilidades para subir imágenes propias desde el equipo del usuario.
 *
 * Las imágenes se reducen en el navegador y se convierten a data URLs para
 * guardarlas junto a las claves locales del catálogo. Así funcionan en todas
 * las vistas (galería, detalle, QA y biblioteca) sin depender de archivos
 * servidos desde el backend.
 */

export const MAX_PREVIEW_IMAGES = 6;
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
/** Tope del data URL final; el backend acepta hasta 1 MB por imagen. */
const MAX_DATA_URL_LENGTH = 900_000;
/** Los avatares se guardan más chicos: se muestran en círculos de 80 px. */
const MAX_AVATAR_DATA_URL_LENGTH = 250_000;

const ACCEPTED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.avif'];

function isSupportedFile(file: File): boolean {
  if (file.type) return ACCEPTED_MIME.includes(file.type.toLowerCase());
  const name = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((extension) => name.endsWith(extension));
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No pudimos leer la imagen.'));
    };
    image.src = objectUrl;
  });
}

function render(
  image: HTMLImageElement,
  maxSide: number,
  quality: number,
  mimeType: string
): string {
  const ratio = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * ratio));
  const height = Math.max(1, Math.round(image.naturalHeight * ratio));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Tu navegador no permite procesar imágenes.');

  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL(mimeType, quality);
}

/**
 * Convierte un archivo en un data URL optimizado y listo para guardar.
 * Lanza un Error con un mensaje en español si no se puede procesar.
 */
async function convertFile(
  file: File,
  { maxSide, maxLength }: { maxSide: number; maxLength: number }
): Promise<string> {
  if (!isSupportedFile(file)) {
    throw new Error('Formato no compatible. Usá JPG, PNG, WebP o AVIF.');
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('La imagen supera los 8 MB.');
  }

  const image = await loadImage(file);
  const attempts = [
    { maxSide, quality: 0.82 },
    { maxSide: Math.round(maxSide * 0.8), quality: 0.74 },
    { maxSide: Math.round(maxSide * 0.6), quality: 0.66 },
  ];

  for (const attempt of attempts) {
    const dataUrl = render(image, attempt.maxSide, attempt.quality, 'image/webp');
    if (dataUrl.startsWith('data:image/webp')) {
      if (dataUrl.length <= maxLength) return dataUrl;
      continue;
    }
    // Navegadores sin soporte de WebP: probamos JPEG antes de rendirnos.
    const jpeg = render(image, attempt.maxSide, attempt.quality, 'image/jpeg');
    if (jpeg.length <= maxLength) return jpeg;
  }

  throw new Error('La imagen sigue siendo muy pesada. Probá con una más liviana.');
}

/** Imagen de galería para una fórmula (máx. ~1400 px). */
export function fileToPreviewDataUrl(file: File): Promise<string> {
  return convertFile(file, { maxSide: 1400, maxLength: MAX_DATA_URL_LENGTH });
}

/** Foto de perfil (máx. 320 px, suficiente para el avatar circular). */
export function fileToAvatarDataUrl(file: File): Promise<string> {
  return convertFile(file, { maxSide: 320, maxLength: MAX_AVATAR_DATA_URL_LENGTH });
}
