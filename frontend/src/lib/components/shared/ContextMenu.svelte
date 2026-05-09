<script lang="ts">
    type MenuItem =
        | {
              label: string;
              onSelect: () => void;
              danger?: boolean;
              kbd?: string;
              divider?: false;
          }
        | {divider: true};

    let {
        open,
        x,
        y,
        items,
        onclose,
    }: {
        open: boolean;
        x: number;
        y: number;
        items: MenuItem[];
        onclose: () => void;
    } = $props();

    let menuEl = $state<HTMLDivElement | null>(null);
    let pos = $state({left: 0, top: 0});

    // Position the menu, then nudge inward if it would overflow the viewport.
    $effect(() => {
        if (!open || !menuEl) return;
        const rect = menuEl.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const margin = 8;
        let left = x;
        let top = y;
        if (left + rect.width > vw - margin) left = vw - rect.width - margin;
        if (top + rect.height > vh - margin) top = vh - rect.height - margin;
        if (left < margin) left = margin;
        if (top < margin) top = margin;
        pos = {left, top};
    });

    $effect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onclose();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });
</script>

{#if open}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="fixed inset-0 z-40"
        onclick={onclose}
        oncontextmenu={e => {
            e.preventDefault();
            onclose();
        }}
    ></div>
    <div
        bind:this={menuEl}
        class="bg-bg-secondary border-border fixed z-50 min-w-[180px] border py-1 shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
        style:left="{pos.left}px"
        style:top="{pos.top}px"
        role="menu"
    >
        {#each items as item}
            {#if 'divider' in item && item.divider}
                <div class="bg-border my-1 h-px"></div>
            {:else if !('divider' in item) || !item.divider}
                {@const it = item as Exclude<MenuItem, {divider: true}>}
                <button
                    type="button"
                    role="menuitem"
                    class="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-[11px] transition-colors {it.danger
                        ? 'text-destructive/80 hover:text-destructive hover:bg-destructive/10'
                        : 'text-fg-secondary hover:text-fg-primary hover:bg-bg-hover'}"
                    onclick={() => {
                        it.onSelect();
                        onclose();
                    }}
                >
                    <span>{it.label}</span>
                    {#if it.kbd}
                        <span class="text-fg-dimmed font-mono text-[9px]"
                            >{it.kbd}</span
                        >
                    {/if}
                </button>
            {/if}
        {/each}
    </div>
{/if}
