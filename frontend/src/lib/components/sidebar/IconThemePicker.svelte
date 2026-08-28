<script lang="ts">
    import {onMount} from 'svelte';
    import Modal from '$lib/components/shared/Modal.svelte';
    import CloseIcon from '$lib/components/shared/CloseIcon.svelte';
    import IconThemePreview from './IconThemePreview.svelte';
    import {getIconTheme, setIconTheme} from '$lib/stores/theme.svelte';
    import type {IconThemeSelection} from '$lib/types/theme';
    import {
        isAppIncluded,
        toggleAppInclusion,
    } from '$lib/stores/settings.svelte';
    import type {icontheme} from '../../../../wailsjs/go/models';

    type ThemeSummary = icontheme.ThemeSummary;

    let open = $state(false);
    let query = $state('');
    let themes = $state<ThemeSummary[]>([]);
    let loaded = $state(false);
    let loading = $state(false);
    let error = $state('');
    let catalogRevision = $state(0);
    let searchInput = $state<HTMLInputElement | null>(null);

    let selection = $derived(getIconTheme());
    let enabled = $derived(isAppIncluded('icons'));
    let selectedTheme = $derived(
        selection.mode === 'explicit'
            ? themes.find(theme => theme.id === selection.id)
            : undefined
    );
    let missing = $derived(
        loaded && selection.mode === 'explicit' && !selectedTheme
    );
    let summary = $derived(
        selection.mode === 'automatic'
            ? 'Automatic · Yaru match'
            : selectedTheme
              ? selectedTheme.name
              : missing
                ? `${selection.id} · Missing`
                : selection.id
    );
    let filteredThemes = $derived.by(() => {
        const needle = query.trim().toLocaleLowerCase();
        if (!needle) return themes;
        return themes.filter(
            theme =>
                theme.name.toLocaleLowerCase().includes(needle) ||
                theme.id.toLocaleLowerCase().includes(needle)
        );
    });

    $effect(() => {
        if (open) queueMicrotask(() => searchInput?.focus());
    });

    async function loadThemes(refresh = false) {
        if (loading) return;
        loading = true;
        error = '';
        try {
            const api = await import('../../../../wailsjs/go/main/App');
            const result = refresh
                ? await api.RefreshInstalledIconThemes()
                : await api.ListInstalledIconThemes();
            themes = Array.isArray(result) ? result : [];
            catalogRevision += 1;
            loaded = true;
        } catch {
            error = refresh
                ? 'Could not refresh installed icon themes. Your selection was not changed.'
                : 'Could not load installed icon themes. Your selection was not changed.';
        } finally {
            loading = false;
        }
    }

    function showPicker() {
        open = true;
        if (!loaded) loadThemes();
    }

    function choose(next: IconThemeSelection) {
        setIconTheme(next);
        open = false;
    }

    onMount(() => {
        loadThemes();
    });
</script>

<div class="flex items-center gap-2">
    <span class="text-fg-secondary shrink-0 text-[11px]">Icons</span>
    <button
        type="button"
        class="border-border bg-bg-surface hover:bg-bg-hover ml-auto flex min-w-0 flex-1 items-center gap-1 border px-2 py-1 text-left transition-colors disabled:cursor-default disabled:opacity-50"
        class:border-warning={missing}
        onclick={showPicker}
        disabled={!enabled}
        aria-label={`Choose icon theme, current: ${summary}`}
        title={enabled
            ? 'Choose an installed desktop icon theme'
            : 'Enable Icons to choose a theme'}
    >
        <span
            class="min-w-0 flex-1 truncate text-[10px]"
            class:text-warning={missing}
            class:text-fg-secondary={!missing}>{summary}</span
        >
        <span class="text-fg-dimmed text-[11px]" aria-hidden="true">›</span>
    </button>
    <button
        type="button"
        class="relative h-4 w-8 shrink-0 transition-colors duration-150
        {enabled ? 'bg-accent' : 'bg-bg-surface border-border border'}"
        onclick={() => toggleAppInclusion('icons')}
        role="switch"
        aria-checked={enabled}
        aria-label="Toggle Icons"
    >
        <span
            class="bg-fg-primary absolute left-0.5 top-0.5 h-3 w-3 transition-transform duration-150
            {enabled ? 'translate-x-4' : 'translate-x-0'}"
        ></span>
    </button>
</div>

<Modal
    {open}
    onclose={() => (open = false)}
    panelClass="w-[560px] max-h-[82vh] flex flex-col"
>
    <div class="mb-3 flex items-center gap-2">
        <h3 class="text-fg-primary text-[12px] font-medium">
            Choose icon theme
        </h3>
        <button
            type="button"
            class="text-fg-dimmed hover:text-fg-primary ml-auto p-1 transition-colors"
            onclick={() => (open = false)}
            aria-label="Close icon theme picker"
            title="Close"
        >
            <CloseIcon size="h-3.5 w-3.5" />
        </button>
    </div>

    <div class="mb-3 flex gap-2">
        <input
            bind:this={searchInput}
            bind:value={query}
            type="search"
            class="bg-bg-surface border-border text-fg-primary placeholder:text-fg-dimmed focus:border-border-focus min-w-0 flex-1 border px-2 py-1.5 text-[11px] outline-none"
            placeholder="Search installed themes…"
            aria-label="Search installed icon themes"
        />
        <button
            type="button"
            class="border-border text-fg-secondary hover:bg-bg-hover border px-2.5 py-1.5 text-[10px] transition-colors disabled:opacity-50"
            onclick={() => loadThemes(true)}
            disabled={loading}
        >
            {loading ? 'Refreshing…' : 'Refresh'}
        </button>
    </div>

    {#if error}
        <p class="text-warning mb-2 text-[10px]" role="status">{error}</p>
    {/if}

    <div class="border-border min-h-0 flex-1 overflow-y-auto border" role="radiogroup" aria-label="Icon themes">
        <button
            type="button"
            role="radio"
            aria-checked={selection.mode === 'automatic'}
            class="border-border hover:bg-bg-hover flex w-full items-start gap-2 border-b px-3 py-2 text-left transition-colors"
            class:bg-accent-muted={selection.mode === 'automatic'}
            onclick={() => choose({mode: 'automatic'})}
        >
            <span class="text-accent mt-0.5 text-[11px]" aria-hidden="true">
                {selection.mode === 'automatic' ? '●' : '○'}
            </span>
            <span>
                <span class="text-fg-primary block text-[11px] font-medium"
                    >Automatic — color-matched Yaru</span
                >
                <span class="text-fg-dimmed mt-0.5 block text-[10px]">
                    Uses Aether’s palette-derived Yaru variant
                </span>
            </span>
        </button>

        {#if missing && selection.mode === 'explicit'}
            <button
                type="button"
                role="radio"
                aria-checked="true"
                class="border-border bg-accent-muted hover:bg-bg-hover flex w-full items-start gap-2 border-b px-3 py-2 text-left transition-colors"
                onclick={() => (open = false)}
            >
                <span class="text-warning mt-0.5 text-[11px]" aria-hidden="true"
                    >●</span
                >
                <span>
                    <span class="text-warning block text-[11px] font-medium"
                        >{selection.id} · Missing</span
                    >
                    <span class="text-fg-dimmed mt-0.5 block text-[10px]">
                        This icon theme is not currently installed. Aether will
                        preserve its ID.
                    </span>
                </span>
            </button>
        {/if}

        {#if loading && !loaded}
            <p class="text-fg-dimmed px-3 py-5 text-center text-[10px]" role="status">
                Loading installed icon themes…
            </p>
        {:else if loaded && themes.length === 0}
            <p class="text-fg-dimmed px-3 py-5 text-center text-[10px]">
                No installed icon themes were found. Automatic Yaru is still available.
            </p>
        {:else if filteredThemes.length === 0}
            <p class="text-fg-dimmed px-3 py-5 text-center text-[10px]">
                No installed themes match this search.
            </p>
        {:else}
            {#each filteredThemes as theme (theme.id + ':' + catalogRevision)}
                <button
                    type="button"
                    role="radio"
                    aria-checked={selection.mode === 'explicit' && selection.id === theme.id}
                    class="border-border hover:bg-bg-hover flex w-full items-start gap-2 border-b px-3 py-2 text-left transition-colors last:border-b-0"
                    class:bg-accent-muted={selection.mode === 'explicit' && selection.id === theme.id}
                    onclick={() => choose({mode: 'explicit', id: theme.id})}
                >
                    <span class="text-accent mt-0.5 text-[11px]" aria-hidden="true">
                        {selection.mode === 'explicit' && selection.id === theme.id
                            ? '●'
                            : '○'}
                    </span>
                    <span class="min-w-0 flex-1">
                        <span class="flex items-baseline gap-2">
                            <span class="text-fg-primary truncate text-[11px] font-medium"
                                >{theme.name}</span
                            >
                            <span class="text-fg-dimmed ml-auto shrink-0 text-[9px] uppercase tracking-wide">
                                {theme.origin === 'user' ? 'User' : 'System'}
                            </span>
                        </span>
                        {#if theme.id.toLocaleLowerCase() !== theme.name.toLocaleLowerCase()}
                            <span class="text-fg-dimmed mt-0.5 block truncate text-[9px]">
                                {theme.id}
                            </span>
                        {/if}
                        <IconThemePreview
                            themeId={theme.id}
                            themeName={theme.name}
                            hasPreview={theme.hasPreview}
                        />
                    </span>
                </button>
            {/each}
        {/if}
    </div>
</Modal>
