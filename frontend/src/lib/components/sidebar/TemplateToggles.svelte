<script lang="ts">
    import {getSettings, updateSettings} from '$lib/stores/settings.svelte';

    const toggles = [
        {key: 'includeNeovim', label: 'Neovim'},
        {key: 'includeGtk', label: 'GTK'},
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
            <label class="flex cursor-pointer items-center justify-between">
                <span class="text-fg-secondary text-[11px]">{toggle.label}</span
                >
                <button
                    class="relative h-4 w-8 transition-colors duration-150
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
