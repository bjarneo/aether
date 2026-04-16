<script lang="ts">
    let {open, onclose}: {open: boolean; onclose: () => void} = $props();

    const keybindings = [
        {
            group: 'General',
            binds: [
                {keys: 'Ctrl+K', desc: 'Show keyboard shortcuts'},
                {keys: 'Ctrl+Enter', desc: 'Apply theme'},
                {keys: 'Ctrl+S', desc: 'Save blueprint'},
                {keys: 'Ctrl+Z', desc: 'Undo'},
                {keys: 'Ctrl+Shift+Z', desc: 'Redo'},
                {keys: 'Ctrl++', desc: 'Zoom in'},
                {keys: 'Ctrl+-', desc: 'Zoom out'},
                {keys: 'Ctrl+0', desc: 'Reset zoom'},
                {keys: 'Escape', desc: 'Close dialog / color picker'},
            ],
        },
        {
            group: 'Color Picker',
            binds: [
                {keys: 'Shift+C', desc: 'Copy hex value'},
                {keys: 'Shift+V', desc: 'Paste hex value'},
            ],
        },
        {
            group: 'Palette',
            binds: [
                {keys: 'Click', desc: 'Open color picker'},
                {keys: 'Ctrl+Click', desc: 'Copy hex value'},
                {keys: 'Shift+Click', desc: 'Toggle selection'},
            ],
        },
    ];
</script>

{#if open}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        onclick={e => {
            if (e.target === e.currentTarget) onclose();
        }}
        onkeydown={e => {
            if (e.key === 'Escape') onclose();
        }}
    >
        <div class="border-border bg-bg-secondary w-[360px] border shadow-2xl">
            <div
                class="border-border flex items-center justify-between border-b px-4 py-3"
            >
                <span class="text-fg-primary text-[12px] font-medium"
                    >Keyboard Shortcuts</span
                >
                <button
                    class="text-fg-dimmed hover:text-fg-primary flex h-6 w-6 items-center justify-center transition-colors"
                    onclick={onclose}
                >
                    <svg
                        class="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                    >
                        <path d="M18 6L6 18M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
            <div class="max-h-[60vh] overflow-y-auto p-4">
                {#each keybindings as section, i}
                    {#if i > 0}
                        <div class="border-border my-3 border-t"></div>
                    {/if}
                    <span
                        class="text-fg-dimmed mb-2 block text-[9px] uppercase tracking-wider"
                        >{section.group}</span
                    >
                    {#each section.binds as bind}
                        <div class="flex items-center justify-between py-1">
                            <span class="text-fg-secondary text-[11px]"
                                >{bind.desc}</span
                            >
                            <div class="flex gap-1">
                                {#each bind.keys.split('+') as part}
                                    <kbd
                                        class="text-fg-primary border-border bg-bg-hover min-w-[24px] border px-1.5 py-0.5 text-center font-mono text-[10px]"
                                        >{part}</kbd
                                    >
                                {/each}
                            </div>
                        </div>
                    {/each}
                {/each}
            </div>
        </div>
    </div>
{/if}
