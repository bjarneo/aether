<script lang="ts">
    import {onMount} from 'svelte';
    import {
        getActiveTab,
        setActiveTab,
        getSidebarVisible,
        toggleSidebar,
        type Tab,
    } from '$lib/stores/ui.svelte';

    let {onabout}: {onabout?: () => void} = $props();
    let sidebarVisible = $derived(getSidebarVisible());
    let isMac = $state(false);

    onMount(async () => {
        try {
            const {IsMacOS} = await import('../../../../wailsjs/go/main/App');
            isMac = await IsMacOS();
        } catch {}
    });

    async function openGitHub() {
        const {BrowserOpenURL} = await import(
            '../../../../wailsjs/runtime/runtime'
        );
        BrowserOpenURL('https://github.com/bjarneo/aether');
    }

    const tabs: {id: Tab; label: string; icon: string}[] = [
        {
            id: 'editor',
            label: 'Editor',
            // Sliders (adjustments)
            icon: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
        },
        {
            id: 'wallhaven',
            label: 'Wallhaven',
            // Globe
            icon: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
        },
        {
            id: 'local',
            label: 'Local',
            // Folder
            icon: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
        },
        {
            id: 'favorites',
            label: 'Favorites',
            // Heart
            icon: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
        },
        {
            id: 'blueprints',
            label: 'Blueprints',
            // Layers
            icon: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
        },
        {
            id: 'system',
            label: 'System Themes',
            // Paintbrush / Brush
            icon: '<path d="M18.37 2.63a2.12 2.12 0 0 1 3 3L14 13l-4 1 1-4z"/><path d="M9 14.5A3.5 3.5 0 0 0 5.5 18c-1.2 0-2.5.7-2.5 2 2 0 4.5-1 5.5-3.5"/>',
        },
    ];
</script>

<header
    class="bg-bg-secondary border-border flex shrink-0 border-b px-4"
    class:items-end={isMac}
    class:items-center={!isMac}
    class:pb-1.5={isMac}
    class:pl-[84px]={isMac}
    class:h-9={!isMac}
    class:h-[46px]={isMac}
    style="--wails-draggable:drag"
>
    <button
        class="text-fg-primary hover:text-accent mr-6 text-[11px] font-semibold tracking-wide transition-colors duration-100"
        class:pb-1.5={isMac}
        class:ml-2={isMac}
        style="letter-spacing: 0.08em; --wails-draggable:no-drag"
        onclick={openGitHub}
        title="Open GitHub repository">AETHER</button
    >
    <nav class="flex flex-1 justify-center gap-0.5">
        {#each tabs as tab}
            <button
                class="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium transition-all duration-100
          {getActiveTab() === tab.id
                    ? 'text-accent bg-accent-muted'
                    : 'text-fg-dimmed hover:text-fg-secondary hover:bg-bg-hover'}"
                onclick={() => setActiveTab(tab.id)}
            >
                <svg
                    class="h-3 w-3 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    {@html tab.icon}
                </svg>
                {tab.label}
            </button>
        {/each}
    </nav>
    {#if onabout}
        <button
            class="text-fg-dimmed hover:text-fg-secondary px-2 text-[10px] transition-colors duration-100"
            class:pb-1.5={isMac}
            onclick={onabout}
            aria-label="About Aether"
            style="--wails-draggable:no-drag">About</button
        >
    {/if}
    <button
        class="text-fg-dimmed hover:text-fg-primary ml-1 flex h-6 w-6 items-center justify-center transition-colors duration-100"
        class:mb-0.5={isMac}
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
