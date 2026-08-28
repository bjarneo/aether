import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

import {
    AUTOMATIC_ICON_THEME,
    normalizeIconThemeSelection,
} from '../src/lib/types/theme.ts';

test('legacy and automatic selections normalize to Automatic', () => {
    assert.deepEqual(
        normalizeIconThemeSelection(undefined),
        AUTOMATIC_ICON_THEME
    );
    assert.deepEqual(
        normalizeIconThemeSelection({mode: 'automatic'}),
        AUTOMATIC_ICON_THEME
    );
});

test('safe missing explicit selection is preserved exactly', () => {
    assert.deepEqual(
        normalizeIconThemeSelection({
            mode: 'explicit',
            id: 'Missing-But-Safe',
        }),
        {mode: 'explicit', id: 'Missing-But-Safe'}
    );
});

test('icon theme control is promoted below Light mode, not buried in Apps', async () => {
    const settingsSidebar = await readFile(
        new URL(
            '../src/lib/components/sidebar/SettingsSidebar.svelte',
            import.meta.url
        ),
        'utf8'
    );
    const templateToggles = await readFile(
        new URL(
            '../src/lib/components/sidebar/TemplateToggles.svelte',
            import.meta.url
        ),
        'utf8'
    );
    const picker = settingsSidebar.indexOf('<IconThemePicker');
    const generate = settingsSidebar.indexOf('<SectionLabel label="Generate"');
    assert.ok(picker >= 0, 'SettingsSidebar must render IconThemePicker');
    assert.ok(picker < generate, 'IconThemePicker must appear above Generate');
    assert.ok(
        !templateToggles.includes('<IconThemePicker'),
        'TemplateToggles must not retain the buried duplicate picker'
    );
    assert.ok(
        templateToggles.includes("k !== 'icons'"),
        'TemplateToggles must exclude the promoted Icons target from Apps'
    );
});

test('refresh remounts previews for themes whose IDs did not change', async () => {
    const picker = await readFile(
        new URL(
            '../src/lib/components/sidebar/IconThemePicker.svelte',
            import.meta.url
        ),
        'utf8'
    );
    assert.ok(
        picker.includes('catalogRevision'),
        'IconThemePicker must version preview rows after a catalog refresh'
    );
    assert.match(
        picker,
        /#each filteredThemes as theme \(theme\.id \+ ['"]:['"] \+ catalogRevision\)/,
        'preview row keys must include the catalog revision'
    );
});
