<script lang="ts">
    import {onMount} from 'svelte';
    import {
        isAppIncluded,
        toggleAppInclusion,
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
        {key: 'neovim', label: 'Neovim'},
        {key: 'zed', label: 'Zed'},
        {key: 'vscode', label: 'VS Code'},
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
                        !SPECIAL_APP_KEYS.has(k) &&
                        !ALWAYS_INCLUDED_APPS.has(k) &&
                        k !== 'icons'
                )
                .sort();
        } catch {
            appList = [];
        }
    });
</script>

{#snippet toggleRow(label: string, on: boolean, onflip: () => void)}
    <label class="flex cursor-pointer items-center justify-between gap-3">
        <span class="text-fg-secondary text-[11px]">{label}</span>
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
            {@render toggleRow(toggle.label, isAppIncluded(toggle.key), () =>
                toggleAppInclusion(toggle.key)
            )}
        {/each}

        {#if appList.length > 0}
            <div class="mt-2">
                <ExpandableSection title="Apps" bind:expanded={appsOpen}>
                    <div class="flex flex-col gap-2">
                        {#each appList as app}
                            {@render toggleRow(
                                appLabel(app),
                                isAppIncluded(app),
                                () => toggleAppInclusion(app)
                            )}
                        {/each}
                    </div>
                </ExpandableSection>
            </div>
        {/if}
    </div>
</ExpandableSection>
