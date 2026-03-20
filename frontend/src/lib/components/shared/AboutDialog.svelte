<script lang="ts">
    import {getExtendedColors, getPalette} from '$lib/stores/theme.svelte';

    let {open = false, onclose}: {open: boolean; onclose: () => void} =
        $props();

    async function openURL(url: string) {
        try {
            const {BrowserOpenURL} = await import(
                '../../../../wailsjs/runtime/runtime'
            );
            BrowserOpenURL(url);
        } catch {}
    }

    // Tokyo Night defaults, overridden by current palette if available
    const tokyoNight = [
        '#f7768e',
        '#9ece6a',
        '#e0af68',
        '#7aa2f7',
        '#bb9af7',
        '#7dcfff',
        '#a9b1d6',
    ];

    function getLogoColors(): string[] {
        const ext = getExtendedColors();
        const p = getPalette();
        // Use palette colors if they differ from defaults, otherwise Tokyo Night
        const hasCustom = p[1] !== '#f38ba8';
        if (hasCustom) {
            return [p[1], p[2], p[3], p[4], p[5], p[6], p[7]];
        }
        if (ext.accent && ext.accent !== '#89b4fa') {
            return [
                p[1] || tokyoNight[0],
                p[2] || tokyoNight[1],
                p[3] || tokyoNight[2],
                ext.accent,
                p[5] || tokyoNight[4],
                p[6] || tokyoNight[5],
                p[7] || tokyoNight[6],
            ];
        }
        return tokyoNight;
    }

    // ASCII art lines for the "A" logo
    const logoLines = [
        '      _/_/    ',
        '   _/    _/   ',
        '  _/_/_/_/    ',
        ' _/    _/     ',
        '_/    _/      ',
    ];
</script>

{#if open}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        onclick={e => {
            if (e.target === e.currentTarget) onclose();
        }}
        onkeydown={e => e.key === 'Escape' && onclose()}
    >
        <div
            class="w-80 border border-[rgba(255,255,255,0.08)] bg-[#131318] shadow-2xl"
        >
            <div class="p-6 text-center">
                <!-- ASCII "A" logo with one color per line -->
                <pre
                    class="mx-auto mb-4 inline-block select-none text-left font-mono text-[13px] leading-[1.2]">{#each logoLines as line, i}{@const colors =
                            getLogoColors()}<span
                            style:color={colors[i % colors.length]}>{line}</span
                        >{#if i < logoLines.length - 1}{/if}{/each}</pre>

                <h2 class="text-fg-primary mb-0.5 text-[15px] font-semibold">
                    Aether
                </h2>
                <p class="text-fg-secondary mb-4 text-[11px]">
                    Desktop Theming Application
                </p>

                <p class="text-fg-dimmed mb-4 text-[11px]">
                    Generate color palettes from wallpapers and apply unified
                    themes to your terminal, editor, window manager, and system
                    UI.
                </p>

                <div class="text-fg-dimmed mb-4 space-y-1 text-[10px]">
                    <p>Built with Wails + Go + Svelte 5</p>
                    <p>Version 3.0.0</p>
                    <p>by Bjarne Øverli</p>
                </div>

                <div class="flex justify-center gap-4">
                    <button
                        onclick={() =>
                            openURL('https://github.com/bjarneo/aether')}
                        class="text-fg-secondary hover:text-accent text-[11px] transition-colors"
                        >GitHub</button
                    >
                    <button
                        onclick={() => openURL('https://x.com/iamdothash')}
                        class="text-fg-secondary hover:text-accent text-[11px] transition-colors"
                        >X / Twitter</button
                    >
                </div>
            </div>

            <div
                class="flex justify-center border-t border-[rgba(255,255,255,0.06)] p-3"
            >
                <button
                    class="bg-accent hover:bg-accent-hover px-4 py-1.5 text-[11px] font-medium text-[#111116]"
                    onclick={onclose}>Close</button
                >
            </div>
        </div>
    </div>
{/if}
