<script lang="ts">
    import {onMount} from 'svelte';
    import {showToast} from '$lib/stores/ui.svelte';

    type Blueprint = {name: string; palette: {colors: string[]}};

    let blueprints = $state<Blueprint[]>([]);
    let search = $state('');
    let filtered = $derived(
        search
            ? blueprints.filter(b =>
                  b.name.toLowerCase().includes(search.toLowerCase())
              )
            : blueprints
    );

    onMount(async () => {
        try {
            const {ListBlueprints} = await import(
                '../../../../wailsjs/go/main/App'
            );
            blueprints = ((await ListBlueprints()) || []) as Blueprint[];
        } catch {
            blueprints = [];
        }
    });

    async function apply(bp: Blueprint) {
        try {
            const {ApplyBlueprint} = await import(
                '../../../../wailsjs/go/main/App'
            );
            await ApplyBlueprint(bp.name);
            const {Quit} = await import('../../../../wailsjs/runtime/runtime');
            Quit();
        } catch (e: any) {
            showToast('Failed: ' + (e?.message || 'unknown'));
        }
    }

    function onKeydown(e: KeyboardEvent) {
        if (e.key === 'Escape') {
            import('../../../../wailsjs/runtime/runtime').then(({Quit}) =>
                Quit()
            );
        }
    }
</script>

<svelte:window on:keydown={onKeydown} />

<div
    class="bg-bg-primary text-fg-primary flex h-screen flex-col"
    style="--wails-draggable: drag"
>
    <!-- Title bar -->
    <div
        class="border-border flex items-center justify-between border-b px-3 py-2"
    >
        <span
            class="text-fg-dimmed text-[11px] font-medium uppercase tracking-wider"
            >Blueprints</span
        >
        <button
            class="text-fg-dimmed hover:text-fg-primary text-[10px]"
            onclick={() =>
                import('../../../../wailsjs/runtime/runtime').then(({Quit}) =>
                    Quit()
                )}>Esc</button
        >
    </div>

    <!-- Search -->
    <div class="px-3 py-2">
        <input
            type="text"
            class="bg-bg-surface border-border text-fg-primary focus:border-accent w-full border px-2 py-1.5 text-[11px] outline-none"
            placeholder="Search..."
            bind:value={search}
            autofocus
        />
    </div>

    <!-- Blueprint list -->
    <div class="flex-1 overflow-y-auto px-2 pb-2">
        {#if filtered.length === 0}
            <div
                class="text-fg-dimmed flex h-full items-center justify-center text-[11px]"
            >
                {blueprints.length === 0 ? 'No blueprints saved' : 'No matches'}
            </div>
        {:else}
            <div class="flex flex-col gap-1">
                {#each filtered as bp}
                    <button
                        class="hover:bg-bg-elevated group flex items-center gap-2 px-2 py-1.5 text-left transition-colors"
                        onclick={() => apply(bp)}
                    >
                        <span
                            class="text-fg-secondary flex-1 truncate text-[11px]"
                            >{bp.name}</span
                        >
                        <div class="flex h-4 w-24 shrink-0">
                            {#each (bp.palette?.colors || []).slice(0, 8) as color}
                                <div
                                    class="flex-1"
                                    style:background-color={color}
                                ></div>
                            {/each}
                        </div>
                    </button>
                {/each}
            </div>
        {/if}
    </div>
</div>
