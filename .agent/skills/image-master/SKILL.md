---
name: image-master
description: Specialized knowledge and workflows for handling images. Use this skill when the user asks about image processing, formats, color theory, imaging science, or verifying image quality. Includes references for upload/download, filters, and color grading.
---

# Image Master Skill

This skill provides specialized knowledge and workflows for handling image-related tasks.

## Core Capabilities

- **Image Formats**: Understanding compression, transparency, and use cases (JPG, PNG, WebP, AVIF, SVG).
- **Image Processing**: Blurring, sharpening, resizing, and applying filters.
- **Color Theory**: Color grading, palette selection, accessibility contrast, and color spaces (sRGB, P3, CMYK).
- **Imaging Science**: Basics of digital imaging, resolution, bit depth, and artifacts.

## Instruction

When the user asks about image-related topics, follow these guidelines:

1.  **Identify the specific domain**: Is it about file formats, aesthetic processing, or technical theory?
2.  **Consult References**: Use the appropriate reference file in the `references/` directory for detailed information.
3.  **Provide Contextual Advice**: Don't just list facts; explain *why* a certain format or technique is better for the user's specific context (e.g., "Use WebP for web icons to support transparency with smaller file size").

## Reference Library

Detailed knowledge is organized into the following reference files:

### 1. File Formats & I/O
-   **File**: [image-formats.md](references/image-formats.md)
-   **Contents**: Common formats (JPEG, PNG, GIF, WebP, SVG, AVIF, TIFF, RAW), compression types (Lossy vs Lossless), and best practices for upload/download.

### 2. Image Processing Techniques
-   **File**: [image-processing.md](references/image-processing.md)
-   **Contents**: Transformations (Resize, Crop, Rotate), Filters (Blur, Sharpen, Noise, Grayscale), and advanced manipulation concepts.

### 3. Color Theory & Grading
-   **File**: [color-theory.md](references/color-theory.md)
-   **Contents**: Color spaces (RGB, HSL, CMYK), color grading (Temperature, Tint, Saturation), harmonies (Complementary, Analogous), and accessibility.

### 4. Imaging Science
-   **File**: [imaging-science.md](references/imaging-science.md)
-   **Contents**: Digital image fundamentals (Pixels, Resolution/DPI, Bit Depth), Histograms, Aliasing, and compression artifacts.
