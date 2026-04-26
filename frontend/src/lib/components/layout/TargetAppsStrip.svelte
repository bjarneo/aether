<script lang="ts">
    import {onMount} from 'svelte';
    import {
        getSettings,
        updateSettings,
        isAppExcluded,
        toggleAppExclusion,
    } from '$lib/stores/settings.svelte';
    import {getAppOverrides} from '$lib/stores/theme.svelte';
    import {
        SPECIAL_APP_FLAGS,
        SPECIAL_APP_ORDER,
        ALWAYS_INCLUDED_APPS,
        appLabel,
    } from '$lib/constants/apps';

    let appList = $state<string[]>([]);

    onMount(async () => {
        // Specials always appear: GetTemplateColors filters out apps whose
        // templates have no color variables (vscode.empty.json) or whose
        // filename mangles to a hidden internal name (aether.zed.json →
        // "aether" → dropped). Inject them unconditionally.
        try {
            const {GetTemplateColors} = await import(
                '../../../../wailsjs/go/main/App'
            );
            const result = await GetTemplateColors();
            const all = Object.keys(result || {});
            const rest = all
                .filter(
                    k =>
                        !(k in SPECIAL_APP_FLAGS) &&
                        !ALWAYS_INCLUDED_APPS.has(k)
                )
                .sort();
            appList = [...SPECIAL_APP_ORDER, ...rest];
        } catch {
            appList = [...SPECIAL_APP_ORDER];
        }
    });

    let settings = $derived(getSettings());
    let overrideCount = $derived(
        Object.values(getAppOverrides()).reduce(
            (sum, o) => sum + Object.keys(o).length,
            0
        )
    );

    function isOn(key: string): boolean {
        const flag = SPECIAL_APP_FLAGS[key];
        if (flag) return !!settings[flag];
        return !isAppExcluded(key);
    }

    function toggle(key: string) {
        const flag = SPECIAL_APP_FLAGS[key];
        if (flag) {
            updateSettings({[flag]: !settings[flag]});
            return;
        }
        toggleAppExclusion(key);
    }
</script>

<div
    class="bg-bg-secondary border-border flex shrink-0 items-center gap-2 border-t px-3 py-1.5"
>
    <span
        class="text-fg-dimmed shrink-0 text-[10px] uppercase tracking-wider"
        title="Apps that will receive theme files when you click Apply"
    >
        Targets
    </span>
    <div class="flex min-w-0 flex-1 flex-wrap items-center gap-1">
        {#each appList as app}
            {@const on = isOn(app)}
            <button
                type="button"
                onclick={() => toggle(app)}
                class="border px-2 py-0.5 text-[10px] transition-colors duration-100 {on
                    ? 'bg-accent-muted border-accent text-accent'
                    : 'border-border text-fg-dimmed hover:text-fg-secondary hover:border-border-focus'}"
                title={on
                    ? `${appLabel(app)} will be themed on Apply`
                    : `${appLabel(app)} is excluded from Apply`}
                aria-pressed={on}
            >
                {appLabel(app)}
            </button>
        {/each}
    </div>
    <span class="text-fg-dimmed shrink-0 text-[10px]">
        {#if overrideCount > 0}
            {overrideCount} override{overrideCount === 1 ? '' : 's'}
        {:else}
            no overrides
        {/if}
    </span>
</div>
