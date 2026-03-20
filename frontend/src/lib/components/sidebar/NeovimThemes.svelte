<script lang="ts">
    import ExpandableSection from '$lib/components/shared/ExpandableSection.svelte';
    import {getSettings, updateSettings} from '$lib/stores/settings.svelte';
    import {showToast} from '$lib/stores/ui.svelte';
    import {NEOVIM_PRESETS} from '$lib/constants/neovim-presets';

    let expanded = $state(false);
    let selected = $state('');

    $effect(() => {
        selected = getSettings().selectedNeovimConfig ? findSelectedName() : '';
    });

    function findSelectedName(): string {
        const current = getSettings().selectedNeovimConfig;
        const preset = NEOVIM_PRESETS.find(p => p.config === current);
        return preset?.name || '';
    }

    function handleSelect(preset: (typeof NEOVIM_PRESETS)[0]) {
        updateSettings({selectedNeovimConfig: preset.config});
        selected = preset.name;
        showToast(`Neovim theme: ${preset.name}`);
    }

    function handleClear() {
        updateSettings({selectedNeovimConfig: ''});
        selected = '';
        showToast('Neovim theme cleared (using default)');
    }
</script>

<ExpandableSection
    title="Neovim Theme"
    suffix={selected ? `(${selected})` : ''}
    bind:expanded
>
    <div class="max-h-48 overflow-y-auto">
        <button
            class="mb-0.5 w-full px-2 py-1 text-left text-[10px] transition-colors duration-100
        {!selected
                ? 'text-accent bg-accent-muted'
                : 'text-fg-dimmed hover:text-fg-secondary hover:bg-bg-hover'}"
            onclick={handleClear}>Default (template)</button
        >
        {#each NEOVIM_PRESETS as preset}
            <button
                class="mb-0.5 w-full px-2 py-1 text-left text-[10px] transition-colors duration-100
          {selected === preset.name
                    ? 'text-accent bg-accent-muted'
                    : 'text-fg-dimmed hover:text-fg-secondary hover:bg-bg-hover'}"
                onclick={() => handleSelect(preset)}
            >
                <span>{preset.name}</span>
                <span class="text-fg-dimmed ml-1">by {preset.author}</span>
            </button>
        {/each}
    </div>
</ExpandableSection>
