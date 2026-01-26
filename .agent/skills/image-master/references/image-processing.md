# Image Processing Techniques

## Transformations

-   **Resize / Scale**: Changing the pixel dimensions.
    -   *Downsampling*: Reducing size (requires interpolation algorithms like Bicubic or Lanczos to prevent aliasing).
    -   *Upsampling*: Increasing size (often results in blurriness; AI upscaling is preferred for quality).
-   **Crop**: Selecting a specific region of interest (ROI) and discarding the rest.
-   **Rotate / Flip**: Geometric transformations. Note that JPEG rotation can sometimes be done losslessly by modifying EXIF tags instead of re-encoding.

## Filters & Effects

### Blur
-   **Gaussian Blur**: Smooths image by averaging pixels with neighbors (bell-curve weight). Used for softening backgrounds or privacy.
-   **Motion Blur**: Simulates object movement in a specific direction.
-   **Bokeh**: Aesthetic quality of the blur produced in the out-of-focus parts of an image.

### Sharpen
-   **Unsharp Masking**: Counter-intuitively named; it sharpens by creating a blurred copy, subtracting it from the original to find edges, and then enhancing those edges.

### Color/Tone
-   **Grayscale**: Removing color information (Saturation = 0).
-   **Sepia**: Adding a brownish tone to simulate old photographs.
-   **Invert**: Reversing colors (creating a negative).

## Algorithms Overview
-   **Convolution Matrix (Kernel)**: The mathematical basis for many filters (blur, sharpen, edge detection). A small matrix moves over the image, modifying the center pixel based on its neighbors.
-   **Dithering**: Used when reducing color depth (e.g., to GIF). Simulates missing colors by arranging available pixels in patterns to fool the eye.
