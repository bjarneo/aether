<script lang="ts">
    import {getSettings, updateSettings} from '$lib/stores/settings.svelte';

    const toggles = [
        {key: 'includeNeovim', label: 'Neovim'},
        {
            key: 'includeGtk',
            label: 'GTK',
            description:
                'Writes ~/.config/gtk-{3,4}.0/gtk.css. Switching themes outside Aether leaves this applied — click Clear to revert.',
        },
        {key: 'includeZed', label: 'Zed'},
        {key: 'includeVscode', label: 'VS Code'},
    ] as const;
</script>

<div>
    <h3
        class="text-fg-dimmed mb-2 text-[10px] font-medium uppercase tracking-wider"
    >
        Templates
    </h3>
    <div class="flex flex-col gap-2">
        {#each toggles as toggle}
            <label
                class="flex cursor-pointer items-center justify-between gap-3"
            >
                <div>
                    <span class="text-fg-secondary text-[11px]"
                        >{toggle.label}</span
                    >
                    {#if 'description' in toggle && toggle.description}
                        <p class="text-fg-dimmed text-[9px] leading-snug">
                            {toggle.description}
                        </p>
                    {/if}
                </div>
                <button
                    class="relative h-4 w-8 shrink-0 transition-colors duration-150
            {getSettings()[toggle.key]
                        ? 'bg-accent'
                        : 'bg-bg-surface border-border border'}"
                    onclick={() =>
                        updateSettings({
                            [toggle.key]: !getSettings()[toggle.key],
                        })}
                    role="switch"
                    aria-checked={getSettings()[toggle.key]}
                    aria-label="Toggle {toggle.label}"
                >
                    <span
                        class="bg-fg-primary absolute left-0.5 top-0.5 h-3 w-3 transition-transform duration-150
              {getSettings()[toggle.key] ? 'translate-x-4' : 'translate-x-0'}"
                    ></span>
                </button>
            </label>
        {/each}
    </div>
</div>

<div class="mt-4">
    <h3
        class="text-fg-dimmed mb-2 text-[10px] font-medium uppercase tracking-wider"
    >
        Video Wallpaper
    </h3>
    <div class="flex flex-col gap-2">
        <label class="flex cursor-pointer items-center justify-between gap-3">
            <div>
                <span class="text-fg-secondary text-[11px]">CPU rendering</span>
                <p class="text-fg-dimmed text-[9px] leading-snug">
                    Use software rendering for video wallpapers. Enable if
                    videos fail to display.
                </p>
            </div>
            <button
                class="relative h-4 w-8 shrink-0 transition-colors duration-150
                    {getSettings().videoCpuMode
                    ? 'bg-accent'
                    : 'bg-bg-surface border-border border'}"
                onclick={() =>
                    updateSettings({
                        videoCpuMode: !getSettings().videoCpuMode,
                    })}
                role="switch"
                aria-checked={getSettings().videoCpuMode}
                aria-label="Toggle CPU rendering"
            >
                <span
                    class="bg-fg-primary absolute left-0.5 top-0.5 h-3 w-3 transition-transform duration-150
                        {getSettings().videoCpuMode
                        ? 'translate-x-4'
                        : 'translate-x-0'}"
                ></span>
            </button>
        </label>
    </div>
</div>
