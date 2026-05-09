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
</script>

<div class="flex h-full flex-col overflow-y-auto">
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
