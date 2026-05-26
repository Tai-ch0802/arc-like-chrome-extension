/**
 * @fileoverview Unit tests for colorUtils module.
 * Tests HSL/HEX conversion, contrast calculations, and derived color generation.
 */

import {
    hexToRgb,
    rgbToHex,
    hexToHsl,
    hslToHex,
    adjustLightness,
    hexToRgba,
    getRelativeLuminance,
    calculateContrastRatio,
    meetsWcagAA,
    calculateDerivedColors,
    DEFAULT_CORE_COLORS
} from '../../modules/utils/colorUtils.js';

describe('colorUtils', () => {
    describe('hexToRgb', () => {
        it('should convert black (#000000) correctly', () => {
            expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
        });

        it('should convert white (#ffffff) correctly', () => {
            expect(hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
        });

        it('should convert red (#ff0000) correctly', () => {
            expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
        });

        it('should handle hex without # prefix', () => {
            expect(hexToRgb('1e1e2e')).toEqual({ r: 30, g: 30, b: 46 });
        });
    });

    describe('rgbToHex', () => {
        it('should convert RGB(0, 0, 0) to #000000', () => {
            expect(rgbToHex(0, 0, 0)).toBe('#000000');
        });

        it('should convert RGB(255, 255, 255) to #ffffff', () => {
            expect(rgbToHex(255, 255, 255)).toBe('#ffffff');
        });

        it('should clamp values above 255', () => {
            expect(rgbToHex(300, 255, 255)).toBe('#ffffff');
        });

        it('should clamp values below 0', () => {
            expect(rgbToHex(-10, 0, 0)).toBe('#000000');
        });
    });

    describe('hexToHsl', () => {
        it('should convert black to HSL(0, 0, 0)', () => {
            const hsl = hexToHsl('#000000');
            expect(hsl.l).toBe(0);
        });

        it('should convert white to HSL(0, 0, 100)', () => {
            const hsl = hexToHsl('#ffffff');
            expect(hsl.l).toBe(100);
        });

        it('should convert pure red to HSL(0, 100, 50)', () => {
            const hsl = hexToHsl('#ff0000');
            expect(hsl.h).toBe(0);
            expect(hsl.s).toBe(100);
            expect(hsl.l).toBe(50);
        });

        it('should convert pure green to HSL(120, 100, 50)', () => {
            const hsl = hexToHsl('#00ff00');
            expect(hsl.h).toBe(120);
            expect(hsl.s).toBe(100);
            expect(hsl.l).toBe(50);
        });

        it('should convert pure blue to HSL(240, 100, 50)', () => {
            const hsl = hexToHsl('#0000ff');
            expect(hsl.h).toBe(240);
            expect(hsl.s).toBe(100);
            expect(hsl.l).toBe(50);
        });
    });

    describe('hslToHex', () => {
        it('should convert HSL(0, 0, 0) to black', () => {
            expect(hslToHex(0, 0, 0)).toBe('#000000');
        });

        it('should convert HSL(0, 0, 100) to white', () => {
            expect(hslToHex(0, 0, 100)).toBe('#ffffff');
        });

        it('should convert HSL(0, 100, 50) to red', () => {
            expect(hslToHex(0, 100, 50)).toBe('#ff0000');
        });

        it('should be inverse of hexToHsl', () => {
            const originalHex = '#1e1e2e';
            const hsl = hexToHsl(originalHex);
            const backToHex = hslToHex(hsl.h, hsl.s, hsl.l);
            expect(backToHex.toLowerCase()).toBe(originalHex.toLowerCase());
        });
    });

    describe('adjustLightness', () => {
        it('should increase lightness', () => {
            const original = '#1e1e2e'; // ~12% lightness
            const lighter = adjustLightness(original, 10);
            const originalHsl = hexToHsl(original);
            const lighterHsl = hexToHsl(lighter);
            expect(lighterHsl.l).toBeGreaterThan(originalHsl.l);
        });

        it('should decrease lightness', () => {
            const original = '#808080'; // 50% lightness (gray)
            const darker = adjustLightness(original, -20);
            const originalHsl = hexToHsl(original);
            const darkerHsl = hexToHsl(darker);
            expect(darkerHsl.l).toBeLessThan(originalHsl.l);
        });

        it('should clamp lightness to 0 (not go negative)', () => {
            const result = adjustLightness('#111111', -50);
            const hsl = hexToHsl(result);
            expect(hsl.l).toBeGreaterThanOrEqual(0);
        });

        it('should clamp lightness to 100 (not exceed)', () => {
            const result = adjustLightness('#eeeeee', 50);
            const hsl = hexToHsl(result);
            expect(hsl.l).toBeLessThanOrEqual(100);
        });
    });

    describe('hexToRgba', () => {
        it('should add alpha to color', () => {
            expect(hexToRgba('#ff0000', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
        });

        it('should handle alpha 0', () => {
            expect(hexToRgba('#000000', 0)).toBe('rgba(0, 0, 0, 0)');
        });

        it('should handle alpha 1', () => {
            expect(hexToRgba('#ffffff', 1)).toBe('rgba(255, 255, 255, 1)');
        });
    });

    describe('getRelativeLuminance', () => {
        it('should return 0 for black', () => {
            expect(getRelativeLuminance('#000000')).toBe(0);
        });

        it('should return 1 for white', () => {
            expect(getRelativeLuminance('#ffffff')).toBe(1);
        });

        it('should return ~0.5 for mid-gray', () => {
            const lum = getRelativeLuminance('#808080');
            expect(lum).toBeGreaterThan(0.2);
            expect(lum).toBeLessThan(0.3);
        });
    });

    describe('calculateContrastRatio', () => {
        it('should return 21 for black on white', () => {
            const ratio = calculateContrastRatio('#000000', '#ffffff');
            expect(ratio).toBeCloseTo(21, 0);
        });

        it('should return 1 for same colors', () => {
            const ratio = calculateContrastRatio('#ff0000', '#ff0000');
            expect(ratio).toBeCloseTo(1, 1);
        });

        it('should be symmetric (order independent)', () => {
            const ratio1 = calculateContrastRatio('#000000', '#ffffff');
            const ratio2 = calculateContrastRatio('#ffffff', '#000000');
            expect(ratio1).toBeCloseTo(ratio2, 5);
        });
    });

    describe('meetsWcagAA', () => {
        it('should return true for black on white', () => {
            expect(meetsWcagAA('#000000', '#ffffff')).toBe(true);
        });

        it('should return false for similar colors', () => {
            expect(meetsWcagAA('#cccccc', '#dddddd')).toBe(false);
        });

        it('should return true for good contrast colors', () => {
            expect(meetsWcagAA('#1e1e2e', '#a0e8a0')).toBe(true);
        });
    });

    describe('calculateDerivedColors', () => {
        it('should generate all required CSS variables', () => {
            const derived = calculateDerivedColors(DEFAULT_CORE_COLORS);

            expect(derived['--main-bg-color']).toBeDefined();
            expect(derived['--accent-color']).toBeDefined();
            expect(derived['--text-color-primary']).toBeDefined();
            expect(derived['--element-bg-color']).toBeDefined();
            expect(derived['--element-bg-hover-color']).toBeDefined();
            expect(derived['--element-bg-active-color']).toBeDefined();
            expect(derived['--border-color']).toBeDefined();
            expect(derived['--accent-color-hover']).toBeDefined();
            expect(derived['--danger-color']).toBeDefined();
            expect(derived['--warning-color']).toBeDefined();
        });

        it('should preserve core input colors', () => {
            const coreColors = {
                mainBgColor: '#2a2a3e',
                accentColor: '#ff5500',
                primaryTextColor: '#e0e0e0'
            };
            const derived = calculateDerivedColors(coreColors);

            expect(derived['--main-bg-color']).toBe('#2a2a3e');
            expect(derived['--accent-color']).toBe('#ff5500');
        });

        it('should keep danger and warning colors fixed', () => {
            const derived = calculateDerivedColors(DEFAULT_CORE_COLORS);

            expect(derived['--danger-color']).toBe('#f38ba8');
            expect(derived['--warning-color']).toBe('#f9ab00');
        });

        it('should generate lighter element backgrounds for dark themes', () => {
            const coreColors = {
                mainBgColor: '#1e1e2e', // dark
                accentColor: '#00ff41',
                primaryTextColor: '#a0e8a0'
            };
            const derived = calculateDerivedColors(coreColors);

            const bgHsl = hexToHsl(coreColors.mainBgColor);
            const elementHsl = hexToHsl(derived['--element-bg-color']);

            expect(elementHsl.l).toBeGreaterThan(bgHsl.l);
        });

        it('should generate darker element backgrounds for light themes', () => {
            const coreColors = {
                mainBgColor: '#ffffff', // light
                accentColor: '#1a73e8',
                primaryTextColor: '#202124'
            };
            const derived = calculateDerivedColors(coreColors);

            const bgHsl = hexToHsl(coreColors.mainBgColor);
            const elementHsl = hexToHsl(derived['--element-bg-color']);

            expect(elementHsl.l).toBeLessThan(bgHsl.l);
        });
    });

    describe('DEFAULT_CORE_COLORS', () => {
        it('should have all required color properties', () => {
            expect(DEFAULT_CORE_COLORS.mainBgColor).toBeDefined();
            expect(DEFAULT_CORE_COLORS.accentColor).toBeDefined();
            expect(DEFAULT_CORE_COLORS.primaryTextColor).toBeDefined();
        });

        it('should have valid hex colors', () => {
            const hexPattern = /^#[0-9a-fA-F]{6}$/;
            expect(DEFAULT_CORE_COLORS.mainBgColor).toMatch(hexPattern);
            expect(DEFAULT_CORE_COLORS.accentColor).toMatch(hexPattern);
            expect(DEFAULT_CORE_COLORS.primaryTextColor).toMatch(hexPattern);
        });
    });
});
