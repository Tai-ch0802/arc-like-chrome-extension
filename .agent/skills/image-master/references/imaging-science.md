# Imaging Science

## Digital Image Fundamentals

### Pixels (Picture Element)
The smallest controllable element of a picture represented on the screen.

### Resolution
-   **Pixel Dimensions**: Width x Height (e.g., 1920x1080).
-   **PPI (Pixels Per Inch)**: Screen density. Higher PPI = sharper image on screen (Retina displays ~300+ PPI).
-   **DPI (Dots Per Inch)**: Printer resolution. Standard print is 300 DPI.

### Bit Depth
Number of bits used to represent color for each pixel.
-   **8-bit**: Standard (256 levels per channel, 16.7 million colors).
-   **10-bit / 12-bit**: HDR (High Dynamic Range), smoother gradients, billion+ colors.
-   **16-bit**: High-end editing to prevent banding during processing.

## Histograms
A graphical representation of the tonal distribution in a digital image.
-   **X-axis**: Brightness (0 = Black, 255 = White).
-   **Y-axis**: Number of pixels at that brightness level.
-   **Use**: Checking exposure. "Clipping" occurs when the graph hits the left (underexposed/crushed blacks) or right (overexposed/blown highlights) edges.

## Artifacts
Unwanted distortions in an image.
-   **JPEG Artifacts**: Blockiness or "ringing" noise around edges caused by lossy compression.
-   **Banding**: Visible steps in gradients instead of smooth transitions (low bit-depth issue).
-   **Moire Pattern**: Interference pattern created when two grids are overlaid (e.g., photographing a screen or fabric).
-   **Chromatic Aberration**: Color fringing along boundaries of dark and light parts, caused by lens dispersion.

## Aliasing
Jagged edges ("jaggies") on diagonal lines or curves.
-   **Anti-aliasing**: Smoothing these edges by blending the color of the edge with the background.
