/**
 * @fileoverview Image processing utilities for background image feature.
 * Handles image compression and format conversion.
 * @module imageUtils
 */

/**
 * Processes an image (File or URL) into a compressed WebP Base64 string.
 * @param {File|Blob|string} input - File/Blob object or URL string.
 * @param {Object} [options] - Processing options.
 * @param {number} [options.maxWidth=1920] - Maximum width for resizing.
 * @param {number} [options.quality=0.8] - WebP compression quality (0-1).
 * @returns {Promise<string>} Base64 data URL (data:image/webp;base64,...).
 * @throws {Error} If processing fails.
 */
export async function processImage(input, options = {}) {
    const { maxWidth = 1920, quality = 0.8 } = options;

    let blob;

    // Handle URL input
    if (typeof input === 'string') {
        try {
            const response = await fetch(input);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            blob = await response.blob();
        } catch (error) {
            console.error('[imageUtils] Fetch error:', error);
            throw new Error('Failed to load image from URL. It might be blocked by CORS.');
        }
    } else if (input instanceof File || input instanceof Blob) {
        blob = input;
    } else {
        throw new Error('Invalid input: expected File, Blob, or URL string.');
    }

    // Validate MIME type
    if (!blob.type.startsWith('image/')) {
        throw new Error('Invalid file type. Only images are allowed.');
    }

    // Create ImageBitmap for efficient processing
    let bitmap;
    try {
        bitmap = await createImageBitmap(blob);
    } catch (error) {
        console.error('[imageUtils] Bitmap creation error:', error);
        throw new Error('Failed to decode image.');
    }

    const { width, height } = bitmap;
    let newWidth = width;
    let newHeight = height;

    // Calculate scaled dimensions (maintain aspect ratio)
    if (width > maxWidth) {
        const scale = maxWidth / width;
        newWidth = maxWidth;
        newHeight = Math.round(height * scale);
    }

    // Use OffscreenCanvas if available, fallback to standard Canvas
    let canvas;
    if (typeof OffscreenCanvas !== 'undefined') {
        canvas = new OffscreenCanvas(newWidth, newHeight);
    } else {
        canvas = document.createElement('canvas');
        canvas.width = newWidth;
        canvas.height = newHeight;
    }

    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, newWidth, newHeight);
    bitmap.close(); // Release memory

    // Convert to WebP Base64
    if (canvas instanceof OffscreenCanvas) {
        const compressedBlob = await canvas.convertToBlob({ type: 'image/webp', quality });
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(compressedBlob);
        });
    } else {
        return canvas.toDataURL('image/webp', quality);
    }
}
