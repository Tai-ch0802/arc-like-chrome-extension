/**
 * @fileoverview Color utility functions for HSL/HEX conversion and WCAG contrast calculations.
 * Used by customThemeManager to calculate derived colors from user's core color choices.
 * @module colorUtils
 */

// --- HEX <-> RGB <-> HSL Conversion Functions ---

/**
 * Converts a HEX color to RGB components.
 * @param {string} hex - HEX color (e.g., "#1e1e2e" or "1e1e2e")
 * @returns {{r: number, g: number, b: number}} RGB values (0-255)
 */
export function hexToRgb(hex) {
    const cleanHex = hex.replace('#', '');
    return {
        r: parseInt(cleanHex.substring(0, 2), 16),
        g: parseInt(cleanHex.substring(2, 4), 16),
        b: parseInt(cleanHex.substring(4, 6), 16)
    };
}

/**
 * Converts RGB components to HEX color.
 * @param {number} r - Red (0-255)
 * @param {number} g - Green (0-255)
 * @param {number} b - Blue (0-255)
 * @returns {string} HEX color (e.g., "#1e1e2e")
 */
export function rgbToHex(r, g, b) {
    const toHex = (n) => {
        const clamped = Math.max(0, Math.min(255, Math.round(n)));
        return clamped.toString(16).padStart(2, '0');
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Converts a HEX color to HSL.
 * @param {string} hex - HEX color (e.g., "#1e1e2e")
 * @returns {{h: number, s: number, l: number}} HSL values (h: 0-360, s: 0-100, l: 0-100)
 */
export function hexToHsl(hex) {
    const { r, g, b } = hexToRgb(hex);
    const rNorm = r / 255;
    const gNorm = g / 255;
    const bNorm = b / 255;

    const max = Math.max(rNorm, gNorm, bNorm);
    const min = Math.min(rNorm, gNorm, bNorm);
    const delta = max - min;

    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (delta !== 0) {
        s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);

        switch (max) {
            case rNorm:
                h = ((gNorm - bNorm) / delta + (gNorm < bNorm ? 6 : 0)) * 60;
                break;
            case gNorm:
                h = ((bNorm - rNorm) / delta + 2) * 60;
                break;
            case bNorm:
                h = ((rNorm - gNorm) / delta + 4) * 60;
                break;
        }
    }

    return {
        h: Math.round(h),
        s: Math.round(s * 100),
        l: Math.round(l * 100)
    };
}

/**
 * Converts HSL color to HEX.
 * @param {number} h - Hue (0-360)
 * @param {number} s - Saturation (0-100)
 * @param {number} l - Lightness (0-100)
 * @returns {string} HEX color
 */
export function hslToHex(h, s, l) {
    const sNorm = s / 100;
    const lNorm = l / 100;

    const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = lNorm - c / 2;

    let r, g, b;

    if (h >= 0 && h < 60) {
        [r, g, b] = [c, x, 0];
    } else if (h >= 60 && h < 120) {
        [r, g, b] = [x, c, 0];
    } else if (h >= 120 && h < 180) {
        [r, g, b] = [0, c, x];
    } else if (h >= 180 && h < 240) {
        [r, g, b] = [0, x, c];
    } else if (h >= 240 && h < 300) {
        [r, g, b] = [x, 0, c];
    } else {
        [r, g, b] = [c, 0, x];
    }

    return rgbToHex(
        Math.round((r + m) * 255),
        Math.round((g + m) * 255),
        Math.round((b + m) * 255)
    );
}

// --- Lightness Adjustment Functions ---

/**
 * Adjusts the lightness of a HEX color.
 * @param {string} hexColor - Original HEX color
 * @param {number} amount - Lightness adjustment (-100 to 100)
 * @returns {string} Adjusted HEX color
 */
export function adjustLightness(hexColor, amount) {
    const hsl = hexToHsl(hexColor);
    const newL = Math.max(0, Math.min(100, hsl.l + amount));
    return hslToHex(hsl.h, hsl.s, newL);
}

/**
 * Adds alpha channel to a HEX color, returning an rgba() string.
 * @param {string} hexColor - HEX color
 * @param {number} alpha - Alpha value (0-1)
 * @returns {string} rgba() color string
 */
export function hexToRgba(hexColor, alpha) {
    const { r, g, b } = hexToRgb(hexColor);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// --- WCAG Contrast Calculation ---

/**
 * Calculates the relative luminance of a color (WCAG 2.1).
 * @param {string} hex - HEX color
 * @returns {number} Relative luminance (0-1)
 */
export function getRelativeLuminance(hex) {
    const { r, g, b } = hexToRgb(hex);

    const toLinear = (c) => {
        const sRGB = c / 255;
        return sRGB <= 0.03928
            ? sRGB / 12.92
            : Math.pow((sRGB + 0.055) / 1.055, 2.4);
    };

    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Calculates the contrast ratio between two colors (WCAG 2.1).
 * @param {string} foreground - Foreground HEX color
 * @param {string} background - Background HEX color
 * @returns {number} Contrast ratio (1-21)
 */
export function calculateContrastRatio(foreground, background) {
    const lum1 = getRelativeLuminance(foreground);
    const lum2 = getRelativeLuminance(background);

    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);

    return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Checks if the contrast ratio meets WCAG AA standard (4.5:1 for normal text).
 * @param {string} foreground - Foreground HEX color
 * @param {string} background - Background HEX color
 * @returns {boolean} True if contrast ratio >= 4.5
 */
export function meetsWcagAA(foreground, background) {
    return calculateContrastRatio(foreground, background) >= 4.5;
}

// --- Derived Color Calculation ---

/**
 * Calculates all derived CSS variables from 3 core colors.
 * Implements monochromatic color scheme with lightness adjustments.
 * @param {Object} coreColors - User's core color choices
 * @param {string} coreColors.mainBgColor - Main background color (HEX)
 * @param {string} coreColors.accentColor - Accent color (HEX)
 * @param {string} coreColors.primaryTextColor - Primary text color (HEX)
 * @returns {Object} All CSS variables with their calculated values
 */
export function calculateDerivedColors(coreColors) {
    const { mainBgColor, accentColor, primaryTextColor } = coreColors;

    // Determine if background is dark or light
    const bgLuminance = getRelativeLuminance(mainBgColor);
    const isDarkTheme = bgLuminance < 0.5;

    // Calculate text colors with contrast check
    let textColorPrimary = primaryTextColor;

    // Ensure text has sufficient contrast against background
    if (!meetsWcagAA(primaryTextColor, mainBgColor)) {
        // Auto-adjust: if dark theme, make text lighter; if light theme, make text darker
        const hsl = hexToHsl(primaryTextColor);
        textColorPrimary = isDarkTheme
            ? hslToHex(hsl.h, hsl.s, Math.max(70, hsl.l))
            : hslToHex(hsl.h, hsl.s, Math.min(30, hsl.l));
    }

    // Calculate inverted text color for buttons/badges
    const textColorInverted = mainBgColor;

    // Calculate secondary text colors (monochromatic adjustment)
    const textColorSecondary = adjustLightness(textColorPrimary, isDarkTheme ? -20 : 20);
    const textColorPlaceholder = adjustLightness(textColorPrimary, isDarkTheme ? -30 : 30);
    const textColorLight = adjustLightness(textColorPrimary, isDarkTheme ? 10 : -10);

    // Header color: use accent with adjusted saturation
    const accentHsl = hexToHsl(accentColor);
    const textColorHeader = hslToHex(accentHsl.h, Math.min(accentHsl.s, 70), isDarkTheme ? 45 : 35);

    // Calculate element background colors (monochromatic lightness steps)
    const bgStep = isDarkTheme ? 5 : -5;
    const elementBgColor = adjustLightness(mainBgColor, bgStep);
    const elementBgHoverColor = adjustLightness(mainBgColor, bgStep * 2);
    const elementBgActiveColor = adjustLightness(mainBgColor, bgStep * 3);

    // Border colors
    const borderColor = adjustLightness(mainBgColor, isDarkTheme ? 15 : -15);
    const borderColorAccent = accentColor;

    // Accent variations
    const accentColorHover = adjustLightness(accentColor, isDarkTheme ? 10 : -10);

    // Modal overlay
    const modalOverlayBgColor = hexToRgba(mainBgColor, 0.8);
    const modalShadowColor = 'rgba(0, 0, 0, 0.5)';

    // Search highlight colors (keep distinct for visibility)
    const searchMatchTitle = isDarkTheme ? '#ffff00' : '#fbbc04';
    const searchMatchUrl = isDarkTheme ? '#ff6b9d' : '#ea4335';

    // Link colors (use accent or distinct blue)
    const linkColor = accentHsl.h > 180 && accentHsl.h < 280 ? accentColor : (isDarkTheme ? '#89b4fa' : '#1a73e8');
    const linkColorHover = adjustLightness(linkColor, isDarkTheme ? 10 : -10);

    // Fixed semantic colors (always visible regardless of theme)
    const dangerColor = '#f38ba8';
    const dangerColorHover = '#f5a2b8';
    const infoColor = accentColor;
    const warningColor = '#f9ab00';

    return {
        '--main-bg-color': mainBgColor,
        '--text-color-primary': textColorPrimary,
        '--text-color-secondary': textColorSecondary,
        '--text-color-header': textColorHeader,
        '--text-color-inverted': textColorInverted,
        '--text-color-placeholder': textColorPlaceholder,
        '--text-color-light': textColorLight,
        '--element-bg-color': elementBgColor,
        '--element-bg-hover-color': elementBgHoverColor,
        '--element-bg-active-color': elementBgActiveColor,
        '--border-color': borderColor,
        '--border-color-accent': borderColorAccent,
        '--accent-color': accentColor,
        '--accent-color-hover': accentColorHover,
        '--danger-color': dangerColor,
        '--danger-color-hover': dangerColorHover,
        '--info-color': infoColor,
        '--warning-color': warningColor,
        '--modal-overlay-bg-color': modalOverlayBgColor,
        '--modal-shadow-color': modalShadowColor,
        '--search-match-title': searchMatchTitle,
        '--search-match-url': searchMatchUrl,
        '--link-color': linkColor,
        '--link-color-hover': linkColorHover
    };
}

/**
 * Default core colors (based on Geek theme).
 */
export const DEFAULT_CORE_COLORS = {
    mainBgColor: '#1e1e2e',
    accentColor: '#00ff41',
    primaryTextColor: '#a0e8a0'
};
