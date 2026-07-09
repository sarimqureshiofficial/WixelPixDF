/**
 * Wixel PixDF - Client-side Image Utilities
 */

// Helper to convert File object to Image object
export function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image.'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

// Helper to convert Canvas to Blob
export function canvasToBlob(canvas, mimeType, quality = 0.9) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob);
    }, mimeType, quality);
  });
}

/**
 * Compresses an image client-side using Canvas.
 * @param {File} file 
 * @param {number} quality - between 0.1 and 1.0
 */
export async function compressImage(file, quality) {
  const img = await fileToImage(file);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  
  ctx.drawImage(img, 0, 0);
  
  // Output format defaults to JPEG for compression support (PNG doesn't compress via canvas quality)
  const mimeType = file.type === 'image/png' || file.type === 'image/webp' ? file.type : 'image/jpeg';
  const compressedBlob = await canvasToBlob(canvas, mimeType, quality);
  
  return {
    blob: compressedBlob,
    url: URL.createObjectURL(compressedBlob),
    size: compressedBlob.size
  };
}

/**
 * Resizes an image to specified width and height.
 * @param {File} file 
 * @param {number} width 
 * @param {number} height 
 */
export async function resizeImage(file, width, height) {
  const img = await fileToImage(file);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  canvas.width = width;
  canvas.height = height;
  
  ctx.drawImage(img, 0, 0, width, height);
  
  const resizedBlob = await canvasToBlob(canvas, file.type);
  
  return {
    blob: resizedBlob,
    url: URL.createObjectURL(resizedBlob),
    size: resizedBlob.size
  };
}

/**
 * Converts image format (JPG, PNG, WebP)
 * @param {File} file 
 * @param {string} targetMimeType 
 */
export async function convertImage(file, targetMimeType) {
  const img = await fileToImage(file);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  
  // If target format is JPEG, draw a white background first to avoid transparent PNGs turning black
  if (targetMimeType === 'image/jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  
  ctx.drawImage(img, 0, 0);
  
  const convertedBlob = await canvasToBlob(canvas, targetMimeType, 0.9);
  
  return {
    blob: convertedBlob,
    url: URL.createObjectURL(convertedBlob),
    size: convertedBlob.size
  };
}

/**
 * Crops an image based on normalized percentages (0.0 to 1.0)
 * @param {File} file 
 * @param {object} cropBox - { x, y, width, height } percentage bounding box
 */
export async function cropImage(file, cropBox) {
  const img = await fileToImage(file);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  // Calculate pixel bounds on original image dimensions
  const sourceX = cropBox.x * img.naturalWidth;
  const sourceY = cropBox.y * img.naturalHeight;
  const sourceWidth = cropBox.width * img.naturalWidth;
  const sourceHeight = cropBox.height * img.naturalHeight;
  
  canvas.width = sourceWidth;
  canvas.height = sourceHeight;
  
  ctx.drawImage(
    img, 
    sourceX, sourceY, sourceWidth, sourceHeight, // Source bounds
    0, 0, sourceWidth, sourceHeight              // Destination bounds
  );
  
  const croppedBlob = await canvasToBlob(canvas, file.type);
  
  return {
    blob: croppedBlob,
    url: URL.createObjectURL(croppedBlob),
    size: croppedBlob.size
  };
}
