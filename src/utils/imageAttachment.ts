import { AssistantImageAttachment, AssistantImageRole } from '../types';

export const MAX_ASSISTANT_IMAGES = 2;
export const MAX_RAW_IMAGE_BYTES = 20 * 1024 * 1024; // 20 MB raw upload ceiling
export const TARGET_MAX_IMAGE_EDGE = 1024;
export const TARGET_IMAGE_QUALITY = 0.82;

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/gif',
]);

export function validateReferenceImageFile(file: File): string | null {
  if (!file) {
    return 'No image file was selected.';
  }
  const typeLower = (file.type || '').toLowerCase();
  const nameLower = (file.name || '').toLowerCase();
  const hasAllowedExtension = /\.(jpe?g|png|webp|heic|heif|gif)$/i.test(nameLower);

  if (!ALLOWED_IMAGE_MIME_TYPES.has(typeLower) && !hasAllowedExtension) {
    return 'Unsupported file type. Please choose a JPG, PNG, WebP, or HEIC image.';
  }
  if (file.size > MAX_RAW_IMAGE_BYTES) {
    return 'Image file is too large. Please choose an image under 20 MB.';
  }
  return null;
}

export function calculateScaledDimensions(
  sourceWidth: number,
  sourceHeight: number,
  maxEdge: number = TARGET_MAX_IMAGE_EDGE
): { width: number; height: number } {
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return { width: maxEdge, height: maxEdge };
  }
  if (sourceWidth <= maxEdge && sourceHeight <= maxEdge) {
    return { width: Math.round(sourceWidth), height: Math.round(sourceHeight) };
  }
  if (sourceWidth >= sourceHeight) {
    return {
      width: maxEdge,
      height: Math.max(1, Math.round((sourceHeight * maxEdge) / sourceWidth)),
    };
  }
  return {
    width: Math.max(1, Math.round((sourceWidth * maxEdge) / sourceHeight)),
    height: maxEdge,
  };
}

export function extractBase64FromDataUrl(dataUrl: string): string {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return dataUrl.trim();
  return dataUrl.slice(commaIdx + 1).replace(/\s+/g, '');
}

async function decodeImageSource(file: File): Promise<{
  source: ImageBitmap | HTMLImageElement;
  width: number;
  height: number;
  cleanup: () => void;
}> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: 'from-image',
      });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close(),
      };
    } catch {
      // Fallback to HTMLImageElement below if createImageBitmap rejects format
    }
  }

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({
        source: img,
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        cleanup: () => URL.revokeObjectURL(objectUrl),
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not decode this image file. Please try a JPG, PNG, or WebP image.'));
    };
    img.src = objectUrl;
  });
}

function encodeCanvasForAssistant(canvas: HTMLCanvasElement): { dataUrl: string; mimeType: string } {
  // Prefer WebP when supported (preserves alpha & compresses efficiently); fallback to JPEG
  const webpDataUrl = canvas.toDataURL('image/webp', TARGET_IMAGE_QUALITY);
  if (webpDataUrl.startsWith('data:image/webp')) {
    return { dataUrl: webpDataUrl, mimeType: 'image/webp' };
  }
  return {
    dataUrl: canvas.toDataURL('image/jpeg', TARGET_IMAGE_QUALITY),
    mimeType: 'image/jpeg',
  };
}

export async function processReferenceImageFile(
  file: File,
  role: AssistantImageRole = 'both'
): Promise<AssistantImageAttachment> {
  const validationError = validateReferenceImageFile(file);
  if (validationError) {
    throw new Error(validationError);
  }

  const decoded = await decodeImageSource(file);
  try {
    const { width, height } = calculateScaledDimensions(decoded.width, decoded.height, TARGET_MAX_IMAGE_EDGE);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Image processing is not supported in this browser.');
    }

    ctx.drawImage(decoded.source, 0, 0, width, height);
    const { dataUrl, mimeType } = encodeCanvasForAssistant(canvas);
    const base64Data = extractBase64FromDataUrl(dataUrl);

    if (!base64Data) {
      throw new Error('Failed to prepare image data. Please try another file.');
    }

    return {
      id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: file.name || 'reference-image',
      mimeType,
      dataUrl,
      base64Data,
      role,
      width,
      height,
    };
  } finally {
    decoded.cleanup();
  }
}

export function formatAttachmentRoleLabel(role: AssistantImageRole): string {
  if (role === 'character') return 'Character';
  if (role === 'style') return 'Visual Style';
  return 'Character & Style';
}
