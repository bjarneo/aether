<script lang="ts">
    import {onMount} from 'svelte';
    import {
        getSettings,
        updateSettings,
        isAppExcluded,
        toggleAppExclusion,
    } from '$lib/stores/settings.svelte';
    import {
        SPECIAL_APP_KEYS,
        ALWAYS_INCLUDED_APPS,
        appLabel,
    } from '$lib/constants/apps';
    import ExpandableSection from '$lib/components/shared/ExpandableSection.svelte';

    let templatesOpen = $state(true);
    let appsOpen = $state(false);

    const specialToggles = [
        {key: 'includeNeovim', label: 'Neovim'},
        {
            key: 'includeGtk',
            label: 'GTK',
            description:
                'Writes ~/.config/gtk-{3,4}.0/gtk.css. Switching themes outside Aether leaves this applied — click Revert to undo.',
        },
        {key: 'includeZed', label: 'Zed'},
        {key: 'includeVscode', label: 'VS Code'},
    ] as const;

    let appList = $state<string[]>([]);

    onMount(async () => {
        try {
            const {GetTemplateColors} = await import(
                '../../../../wailsjs/go/main/App'
            );
            const result = await GetTemplateColors();
            appList = Object.keys(result || {})
                .filter(
                    k =>
                        !SPECIAL_APP_KEYS.has(k) && !ALWAYS_INCLUDED_APPS.has(k)
                )
                .sort();
        } catch {
            appList = [];
        }
    });
</script>

{#snippet toggleRow(
    label: string,
    on: boolean,
    onflip: () => void,
    description?: string
)}
    <label class="flex cursor-pointer items-center justify-between gap-3">
        <div class="min-w-0">
            <span class="text-fg-secondary text-[11px]">{label}</span>
            {#if description}
                <p class="text-fg-dimmed text-[9px] leading-snug">
                    {description}
                </p>
            {/if}
        </div>
        <button
            class="relative h-4 w-8 shrink-0 transition-colors duration-150
            {on ? 'bg-accent' : 'bg-bg-surface border-border border'}"
            onclick={onflip}
            role="switch"
            aria-checked={on}
            aria-label="Toggle {label}"
        >
            <span
                class="bg-fg-primary absolute left-0.5 top-0.5 h-3 w-3 transition-transform duration-150
              {on ? 'translate-x-4' : 'translate-x-0'}"
            ></span>
        </button>
    </label>
{/snippet}

<ExpandableSection title="Templates" bind:expanded={templatesOpen}>
    <div class="flex flex-col gap-2">
        {#each specialToggles as toggle}
            {@render toggleRow(
                toggle.label,
                !!getSettings()[toggle.key],
                () =>
                    updateSettings({
                        [toggle.key]: !getSettings()[toggle.key],
                    }),
                'description' in toggle ? toggle.description : undefined
            )}
        {/each}

        {#if appList.length > 0}
            <div class="mt-2">
                <ExpandableSection title="Apps" bind:expanded={appsOpen}>
                    <div class="flex flex-col gap-2">
                        {#each appList as app}
                            {@render toggleRow(
                                appLabel(app),
                                !isAppExcluded(app),
                                () => toggleAppExclusion(app)
                            )}
                        {/each}
                    </div>
                </ExpandableSection>
            </div>
        {/if}
    </div>
</ExpandableSection>

<div class="mt-4">
    <h3
        class="text-fg-dimmed mb-2 text-[10px] font-medium uppercase tracking-wider"
    >
        Video Wallpaper
    </h3>
    <div class="flex flex-col gap-2">
        {@render toggleRow(
            'CPU rendering',
            getSettings().videoCpuMode,
            () =>
                updateSettings({
                    videoCpuMode: !getSettings().videoCpuMode,
                }),
            'Use software rendering for video wallpapers. Enable if videos fail to display.'
        )}
    </div>
</div>
