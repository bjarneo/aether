<script lang="ts">
    import type {Command} from '$lib/commands/commands.svelte';

    let {
        open,
        commands,
        onclose,
    }: {
        open: boolean;
        commands: Command[];
        onclose: () => void;
    } = $props();

    let query = $state('');
    let activeIdx = $state(0);
    let inputEl = $state<HTMLInputElement | null>(null);
    let listEl = $state<HTMLElement | null>(null);

    function matches(cmd: Command, q: string): boolean {
        if (!q) return true;
        const hay = (
            cmd.label +
            ' ' +
            cmd.category +
            ' ' +
            (cmd.keywords ?? '')
        ).toLowerCase();
        const needle = q.toLowerCase();
        if (hay.includes(needle)) return true;
        let i = 0;
        for (let j = 0; j < hay.length && i < needle.length; j++) {
            if (hay[j] === needle[i]) i++;
        }
        return i === needle.length;
    }

    let visible = $derived(
        commands.filter(c => (c.visible ? c.visible() : true))
    );
    let filtered = $derived(visible.filter(c => matches(c, query)));

    $effect(() => {
        if (activeIdx >= filtered.length) activeIdx = 0;
    });

    $effect(() => {
        if (open) {
            query = '';
            activeIdx = 0;
            queueMicrotask(() => inputEl?.focus());
        }
    });

    function run(cmd: Command) {
        onclose();
        queueMicrotask(() => {
            try {
                cmd.run();
            } catch (e) {
                console.error('Command failed:', cmd.id, e);
            }
        });
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Escape') {
            onclose();
            e.preventDefault();
            e.stopPropagation();
        } else if (e.key === 'ArrowDown') {
            activeIdx = Math.min(filtered.length - 1, activeIdx + 1);
            scrollActiveIntoView();
            e.preventDefault();
        } else if (e.key === 'ArrowUp') {
            activeIdx = Math.max(0, activeIdx - 1);
            scrollActiveIntoView();
            e.preventDefault();
        } else if (e.key === 'Enter') {
            const cmd = filtered[activeIdx];
            if (cmd) run(cmd);
            e.preventDefault();
            e.stopPropagation();
        } else if (e.key === 'Home') {
            activeIdx = 0;
            scrollActiveIntoView();
            e.preventDefault();
        } else if (e.key === 'End') {
            activeIdx = Math.max(0, filtered.length - 1);
            scrollActiveIntoView();
            e.preventDefault();
        }
    }

    function scrollActiveIntoView() {
        queueMicrotask(() => {
            const el = listEl?.querySelector<HTMLElement>(
                `[data-cmd-idx="${activeIdx}"]`
            );
            el?.scrollIntoView({block: 'nearest'});
        });
    }
</script>

{#if open}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
        class="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[12vh]"
        onclick={e => {
            if (e.target === e.currentTarget) onclose();
        }}
        onkeydown={handleKeydown}
    >
        <div
            class="border-border bg-bg-secondary flex w-[520px] max-w-[90vw] flex-col border shadow-2xl"
        >
            <div class="border-border border-b">
                <input
                    bind:this={inputEl}
                    bind:value={query}
                    type="text"
                    class="text-fg-primary placeholder:text-fg-dimmed w-full bg-transparent px-4 py-3 text-[12px] outline-none"
                    placeholder="Search commands…"
                    spellcheck={false}
                    autocomplete="off"
                />
            </div>
            <div
                bind:this={listEl}
                class="max-h-[50vh] overflow-y-auto"
                role="listbox"
            >
                {#if filtered.length === 0}
                    <div
                        class="text-fg-dimmed px-4 py-6 text-center text-[11px]"
                    >
                        No matching commands
                    </div>
                {:else}
                    {#each filtered as cmd, i}
                        <button
                            type="button"
                            data-cmd-idx={i}
                            class="flex w-full items-center justify-between gap-3 px-4 py-2 text-left transition-colors
                                {i === activeIdx
                                ? 'bg-accent/10 text-fg-primary'
                                : 'text-fg-secondary hover:bg-bg-surface'}"
                            onclick={() => run(cmd)}
                            onmouseenter={() => (activeIdx = i)}
                            role="option"
                            aria-selected={i === activeIdx}
                        >
                            <div class="flex min-w-0 flex-col gap-0.5">
                                <span class="truncate text-[12px]"
                                    >{cmd.label}</span
                                >
                                <span
                                    class="text-fg-dimmed text-[9px] uppercase tracking-wider"
                                    >{cmd.category}</span
                                >
                            </div>
                            {#if cmd.shortcut}
                                <span
                                    class="text-fg-dimmed shrink-0 font-mono text-[10px]"
                                    >{cmd.shortcut}</span
                                >
                            {/if}
                        </button>
                    {/each}
                {/if}
            </div>
            <div
                class="border-border text-fg-dimmed flex items-center justify-between gap-2 border-t px-4 py-1.5 text-[9px]"
            >
                <span>↑↓ navigate · ↵ run · Esc close</span>
                <span class="tabular-nums"
                    >{filtered.length} / {commands.length}</span
                >
            </div>
        </div>
    </div>
{/if}
