<script lang="ts">
    import ExtractionModeSelect from './ExtractionModeSelect.svelte';
    import ColorAdjustments from './ColorAdjustments.svelte';
    import PresetsSection from './PresetsSection.svelte';
    import GradientGenerator from './GradientGenerator.svelte';
    import PaletteFromColor from './PaletteFromColor.svelte';
    import AccessibilityPanel from './AccessibilityPanel.svelte';
    import NeovimThemes from './NeovimThemes.svelte';
    import TemplateToggles from './TemplateToggles.svelte';
    import SectionLabel from '$lib/components/shared/SectionLabel.svelte';
    import {getLightMode, setLightMode} from '$lib/stores/theme.svelte';

    let lightMode = $derived(getLightMode());
</script>

<div class="flex h-full flex-col overflow-y-auto">
    <section class="border-border border-b p-3">
        <label class="flex cursor-pointer items-center justify-between gap-3">
            <span class="text-fg-secondary text-[11px]">Light mode</span>
            <button
                class="relative h-4 w-8 shrink-0 transition-colors duration-150
                {lightMode
                    ? 'bg-accent'
                    : 'bg-bg-surface border-border border'}"
                onclick={() => setLightMode(!lightMode)}
                role="switch"
                aria-checked={lightMode}
                aria-label="Toggle light mode"
            >
                <span
                    class="bg-fg-primary absolute left-0.5 top-0.5 h-3 w-3 transition-transform duration-150
                    {lightMode ? 'translate-x-4' : 'translate-x-0'}"
                ></span>
            </button>
        </label>
    </section>

    <SectionLabel label="Generate" />
    <section class="border-border border-b p-3">
        <ExtractionModeSelect />
    </section>
    <section class="border-border border-b p-3">
        <PresetsSection />
    </section>
    <section class="border-border border-b p-3">
        <PaletteFromColor />
    </section>
    <section class="border-border border-b p-3">
        <GradientGenerator />
    </section>

    <SectionLabel label="Adjust" />
    <section class="border-border border-b p-3">
        <ColorAdjustments />
    </section>
    <section class="border-border border-b p-3">
        <AccessibilityPanel />
    </section>

    <SectionLabel label="Targets" />
    <section class="border-border border-b p-3">
        <NeovimThemes />
    </section>
    <section class="p-3">
        <TemplateToggles />
    </section>
</div>
