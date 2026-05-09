<script lang="ts">
    import LightModeToggle from './LightModeToggle.svelte';
    import ExtractionModeSelect from './ExtractionModeSelect.svelte';
    import ColorAdjustments from './ColorAdjustments.svelte';
    import PresetsSection from './PresetsSection.svelte';
    import GradientGenerator from './GradientGenerator.svelte';
    import PaletteFromColor from './PaletteFromColor.svelte';
    import AccessibilityPanel from './AccessibilityPanel.svelte';
    import NeovimThemes from './NeovimThemes.svelte';
    import TemplateToggles from './TemplateToggles.svelte';
</script>

<div class="flex h-full flex-col overflow-y-auto">
    <section class="border-border border-b p-3">
        <LightModeToggle />
    </section>

    <h4
        class="bg-bg-surface text-fg-dimmed border-border mt-1 border-b border-t px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.12em]"
    >
        Generate
    </h4>
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

    <h4
        class="bg-bg-surface text-fg-dimmed border-border mt-1 border-b border-t px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.12em]"
    >
        Adjust
    </h4>
    <section class="border-border border-b p-3">
        <ColorAdjustments />
    </section>
    <section class="border-border border-b p-3">
        <AccessibilityPanel />
    </section>

    <h4
        class="bg-bg-surface text-fg-dimmed border-border mt-1 border-b border-t px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.12em]"
    >
        Targets
    </h4>
    <section class="border-border border-b p-3">
        <NeovimThemes />
    </section>
    <section class="p-3">
        <TemplateToggles />
    </section>
</div>
