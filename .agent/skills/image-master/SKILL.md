---
name: image-master
description: 影像處理知識：格式 (WebP/PNG/SVG/AVIF)、壓縮、色彩理論、無障礙對比度 (WCAG)、imaging science。對應本專案的 modules/utils/imageUtils.js (WebP 轉換 / 壓縮)、sidepanel 圖示、modules/ui/backgroundImageManager 的自訂背景圖場景。當使用者提到「圖片格式、影像處理、WebP、色彩理論、icon 設計、背景圖、圖片壓縮」時觸發。
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

## 本專案場景對應

本 skill 在這個 Chrome extension 內最常被觸發的具體場景：

| 場景 | 模組 / 檔案 | 重點 |
|---|---|---|
| 使用者上傳自訂背景圖 | `modules/ui/backgroundImageManager.js` | 壓縮 + WebP 轉換、CSS 變數套用、容量 quota |
| 縮圖 / favicon 抓取 | `modules/utils/imageUtils.js` | URL 抓取、resize、WebP 轉換 |
| Extension icons | `icons/extension-icon-{16,32,48,128}.png`、`manifest.json` | retina 友善、透明背景、Chrome Web Store 提交 |
| sidepanel UI 圖示 | `modules/icons.js`（SVG 常數） | 優先 SVG (inline)，避免 raster |

### 本專案常用決策

- **格式選擇**：UI 圖示用 inline SVG（`modules/icons.js`）；使用者上傳圖用 WebP（quality 80）；extension icons 用 PNG with transparency。
- **壓縮策略**：`imageUtils.js` 已實作 WebP 轉換 + 等比 resize，新需求優先沿用既有 util。
- **對比度**：sidepanel 文字與背景的 contrast 需符合 WCAG AA（4.5:1），參考 `color-theory.md`。`modules/utils/colorUtils.js` 已實作 WCAG 對比度計算可重用。
