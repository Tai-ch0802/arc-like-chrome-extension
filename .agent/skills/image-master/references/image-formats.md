# Image Formats & I/O

## Common Formats Overview

| Format | Full Name | Compression | Transparency | Animation | Best Use Case |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **JPEG** | Joint Photographic Experts Group | Lossy | No | No | Photographs, complex gradients, web images where size matters. |
| **PNG** | Portable Network Graphics | Lossless | Yes (Alpha) | No | Logos, screenshots, graphics with text, images needing transparency. |
| **GIF** | Graphics Interchange Format | Lossless (256 colors) | Yes (1-bit) | Yes | Simple animations, memes, retro graphics. |
| **WebP** | Web Picture | Lossy & Lossless | Yes | Yes | Modern web images replacing JPG/PNG (smaller size, high quality). |
| **SVG** | Scalable Vector Graphics | None (Vector) | Yes | Yes | Icons, logos, illustrations that need to scale infinitely without pixelation. |
| **AVIF** | AV1 Image File Format | Lossy & Lossless | Yes | Yes | Next-gen web images, better compression than WebP (limited browser support compared to WebP). |
| **TIFF** | Tagged Image File Format | Lossless / Uncompressed | Yes | No | Print production, high-quality archiving, scanning. |
| **RAW** | Raw Image Formats (CR2, NEF, etc.) | Lossless / Uncompressed | No | No | Professional photography, post-processing source. |

## Upload & Download Best Practices

### Uploading (Client-Side)
1.  **Validation**: Always check file type (MIME) and size limits before upload.
2.  **Preview**: Generate a local preview (Blob URL or FileReader) for immediate UX feedback.
3.  **Compression**: Consider client-side compression (e.g., using Canvas or libraries like `browser-image-compression`) before sending to server to save bandwidth.

### Downloading
1.  **Content-Disposition**: Ensure server sets `Content-Disposition: attachment; filename="name.ext"` for forced download.
2.  **Blob Downloading**: For dynamically generated images:
    ```javascript
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'image.png';
    link.click();
    ```
3.  **Format Selection**: Offer modern formats (WebP) with fallbacks (JPEG/PNG) using the `<picture>` element for web display, but standard formats (PNG/JPG) for user downloads compatibility.
