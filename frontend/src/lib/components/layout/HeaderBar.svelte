<script lang="ts">
    import {
        getActiveTab,
        setActiveTab,
        getSidebarVisible,
        toggleSidebar,
        type Tab,
    } from '$lib/stores/ui.svelte';

    let {onabout}: {onabout?: () => void} = $props();
    let sidebarVisible = $derived(getSidebarVisible());

    async function openGitHub() {
        const {BrowserOpenURL} = await import(
            '../../../../wailsjs/runtime/runtime'
        );
        BrowserOpenURL('https://github.com/bjarneo/aether');
    }

    const tabs: {id: Tab; label: string}[] = [
        {id: 'editor', label: 'Editor'},
        {id: 'wallhaven', label: 'Wallhaven'},
        {id: 'local', label: 'Local'},
        {id: 'favorites', label: 'Favorites'},
        {id: 'blueprints', label: 'Blueprints'},
        {id: 'system', label: 'System Themes'},
    ];
</script>

<header
    class="bg-bg-secondary border-border flex h-9 shrink-0 items-center border-b px-4"
    style="--wails-draggable:drag"
>
    <button
        class="text-fg-primary hover:text-accent mr-6 text-[11px] font-semibold tracking-wide transition-colors duration-100"
        style="letter-spacing: 0.08em; --wails-draggable:no-drag"
        onclick={openGitHub}
        title="Open GitHub repository">AETHER</button
    >
    <nav
        class="flex flex-1 justify-center gap-0.5"
        style="--wails-draggable:no-drag"
    >
        {#each tabs as tab}
            <button
                class="px-4 py-1.5 text-[11px] font-medium transition-all duration-100
          {getActiveTab() === tab.id
                    ? 'text-accent bg-accent-muted'
                    : 'text-fg-dimmed hover:text-fg-secondary hover:bg-bg-hover'}"
                onclick={() => setActiveTab(tab.id)}
            >
                {tab.label}
            </button>
        {/each}
    </nav>
    {#if onabout}
        <button
            class="text-fg-dimmed hover:text-fg-secondary px-2 py-1 text-[10px] transition-colors duration-100"
            onclick={onabout}
            aria-label="About Aether"
            style="--wails-draggable:no-drag">About</button
        >
    {/if}
    <button
        class="text-fg-dimmed hover:text-fg-primary ml-1 flex h-6 w-6 items-center justify-center transition-colors duration-100"
        onclick={toggleSidebar}
        title={sidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
        aria-label="Toggle sidebar"
        style="--wails-draggable:no-drag"
    >
        <svg
            class="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
        >
            <rect x="3" y="3" width="18" height="18" rx="2" /><line
                x1="15"
                y1="3"
                x2="15"
                y2="21"
            />
        </svg>
    </button>
</header>
