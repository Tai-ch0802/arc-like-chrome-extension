// Website locale integrity (BASE-026). The site applies translations via
// innerHTML wholesale (web/js/i18n.js applyTranslations), so a value like
// "<strong>多關鍵字" — truncated at the colon during some past extraction —
// REPLACES the whole element and silently drops the entire description.
// This regression guard fails on any reappearance of that shape.
import fs from 'node:fs';
import path from 'node:path';

// jest runs from the repo root; import.meta.url is unavailable under the
// esbuild CJS transform, so resolve from cwd like the runner does.
const ROOT = path.join(process.cwd(), 'web/locales');
const LOCALES = fs.readdirSync(ROOT).filter(f => f.endsWith('.json'));

// The 38 guide keys hit by the historical truncation (BASE-026): these must
// exist in EVERY locale with complete markup. Other keys keep the repo's
// missing-key-falls-back-to-inline tolerance.
const GUIDE_LI_KEYS = [
    'guide_bm_li1', 'guide_bm_li2', 'guide_bm_li3', 'guide_bm_li4',
    'guide_groups_li2', 'guide_groups_li3',
    'guide_linked_how_li1', 'guide_linked_how_li2', 'guide_linked_how_li3', 'guide_linked_how_li4',
    'guide_reading_li1', 'guide_reading_li2', 'guide_reading_li3', 'guide_reading_li4', 'guide_reading_li5',
    'guide_rss_li1', 'guide_rss_li2', 'guide_rss_li3', 'guide_rss_li4', 'guide_rss_li5',
    'guide_search_li1', 'guide_search_li2', 'guide_search_li3', 'guide_search_li4',
    'guide_tabs_li1', 'guide_tabs_li2', 'guide_tabs_li3', 'guide_tabs_li4', 'guide_tabs_li5', 'guide_tabs_li6',
    'guide_theme_bg_li1', 'guide_theme_bg_li2', 'guide_theme_bg_li3',
    'guide_window_li1', 'guide_window_li2', 'guide_window_li3', 'guide_window_li4', 'guide_window_li5',
];

describe.each(LOCALES)('web locale %s', (file) => {
    const data = JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));

    test('no value carries an unclosed <strong> (the truncation shape)', () => {
        const truncated = Object.entries(data)
            .filter(([, v]) => typeof v === 'string' && v.includes('<strong>') && !v.includes('</strong>'))
            .map(([k]) => k);
        expect(truncated).toEqual([]);
    });

    test('every historically-truncated guide key is present and substantial', () => {
        for (const key of GUIDE_LI_KEYS) {
            expect(data[key]).toBeTruthy();
            // A real entry is label + description — far longer than the bare label.
            expect(data[key].length).toBeGreaterThan('<strong>x</strong>'.length + 5);
        }
    });
});
