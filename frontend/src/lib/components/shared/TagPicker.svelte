<script lang="ts">
    import {
        getLabels,
        getLabelForPath,
        assignLabel,
        removeAssignment,
        createLabel,
        deleteLabel,
        LABEL_COLORS,
    } from '$lib/stores/tags.svelte';

    let {path}: {path: string} = $props();

    let currentLabel = $derived(getLabelForPath(path));
    let allLabels = $derived(getLabels());
    let open = $state(false);
    let creating = $state(false);
    let newName = $state('');
    let newColor = $state(LABEL_COLORS[0]);
    let anchorEl: HTMLElement;

    function toggle(e: MouseEvent) {
        e.stopPropagation();
        e.preventDefault();
        open = !open;
        creating = false;
        newName = '';
        newColor = LABEL_COLORS[allLabels.length % LABEL_COLORS.length];
    }

    function handleCreate() {
        if (!newName.trim()) return;
        const label = createLabel(newName.trim(), newColor);
        assignLabel(path, label.id);
        newName = '';
        creating = false;
        open = false;
    }

    function pick(e: MouseEvent, labelId: string) {
        e.stopPropagation();
        assignLabel(path, labelId);
        open = false;
    }

    function remove(e: MouseEvent) {
        e.stopPropagation();
        removeAssignment(path);
        open = false;
    }
</script>

<div class="relative z-20" bind:this={anchorEl}>
    {#if currentLabel}
        <button
            class="flex items-center gap-1 px-2 py-1 text-[10px] font-medium transition-colors hover:brightness-125"
            style="background-color: {currentLabel.color}20; color: {currentLabel.color}; border: 1px solid {currentLabel.color}40;"
            onclick={toggle}
        >
            <span
                class="h-2 w-2 shrink-0"
                style:background-color={currentLabel.color}
            ></span>
            {currentLabel.name}
        </button>
    {:else}
        <button
            class="text-fg-dimmed hover:text-fg-secondary flex items-center gap-1 border border-[rgba(255,255,255,0.08)] px-2 py-1 text-[10px] transition-colors hover:border-[rgba(255,255,255,0.15)]"
            onclick={toggle}
        >
            <svg
                class="h-3 w-3"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
            >
                <path d="M12 5v14M5 12h14"></path>
            </svg>
            Label
        </button>
    {/if}

    {#if open}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
            class="fixed inset-0 z-40"
            onclick={e => {
                e.stopPropagation();
                open = false;
                creating = false;
            }}
        ></div>
        <div
            class="absolute bottom-full left-0 z-50 mb-1 min-w-[160px] border border-[rgba(255,255,255,0.12)] bg-[#1a1a20] shadow-xl"
        >
            {#if allLabels.length > 0}
                <div class="p-1">
                    {#each allLabels as label}
                        <div class="group/label flex items-center">
                            <button
                                class="flex flex-1 items-center gap-2 px-2.5 py-1.5 text-left text-[11px] transition-colors hover:bg-[rgba(255,255,255,0.06)]
                  {currentLabel?.id === label.id
                                    ? 'text-fg-primary'
                                    : 'text-fg-secondary'}"
                                onclick={e => pick(e, label.id)}
                            >
                                <span
                                    class="h-3 w-3 shrink-0"
                                    style:background-color={label.color}
                                ></span>
                                <span class="flex-1">{label.name}</span>
                                {#if currentLabel?.id === label.id}
                                    <svg
                                        class="text-accent h-3.5 w-3.5 shrink-0"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2.5"
                                    >
                                        <polyline points="20 6 9 17 4 12"
                                        ></polyline>
                                    </svg>
                                {/if}
                            </button>
                            <button
                                class="text-fg-dimmed hover:text-destructive px-1.5 py-1.5 opacity-0 transition-all group-hover/label:opacity-100"
                                onclick={e => {
                                    e.stopPropagation();
                                    deleteLabel(label.id);
                                }}
                                title="Delete label"
                            >
                                <svg
                                    class="h-3 w-3"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    stroke-linecap="round"
                                >
                                    <path d="M18 6L6 18M6 6l12 12"></path>
                                </svg>
                            </button>
                        </div>
                    {/each}
                </div>
            {/if}

            {#if currentLabel}
                <div class="border-t border-[rgba(255,255,255,0.08)] p-1">
                    <button
                        class="text-fg-dimmed hover:text-fg-secondary w-full px-2.5 py-1.5 text-left text-[11px] transition-colors hover:bg-[rgba(255,255,255,0.06)]"
                        onclick={remove}>Remove label</button
                    >
                </div>
            {/if}

            <div class="border-t border-[rgba(255,255,255,0.08)] p-1">
                {#if creating}
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        class="space-y-1.5 px-1.5 py-1"
                        onclick={e => e.stopPropagation()}
                    >
                        <!-- Color selection -->
                        <div class="flex flex-wrap gap-1">
                            {#each LABEL_COLORS as c}
                                <button
                                    class="h-4 w-4 transition-all
                    {newColor === c
                                        ? 'scale-110 ring-1 ring-white ring-offset-1 ring-offset-[#1a1a20]'
                                        : 'hover:scale-110'}"
                                    style:background-color={c}
                                    onclick={e => {
                                        e.stopPropagation();
                                        newColor = c;
                                    }}
                                ></button>
                            {/each}
                        </div>
                        <!-- Name input + confirm -->
                        <div class="flex items-center gap-1">
                            <span
                                class="h-3 w-3 shrink-0"
                                style:background-color={newColor}
                            ></span>
                            <input
                                type="text"
                                class="text-fg-primary focus:border-accent flex-1 border border-[rgba(255,255,255,0.12)] bg-[#0e0e13] px-2 py-1 text-[11px] outline-none"
                                placeholder="Name..."
                                bind:value={newName}
                                onkeydown={e => {
                                    e.stopPropagation();
                                    if (e.key === 'Enter') handleCreate();
                                    if (e.key === 'Escape') creating = false;
                                }}
                                autofocus
                            />
                            <button
                                class="text-accent hover:text-accent-hover p-1"
                                onclick={e => {
                                    e.stopPropagation();
                                    handleCreate();
                                }}
                            >
                                <svg
                                    class="h-4 w-4"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2.5"
                                >
                                    <polyline points="20 6 9 17 4 12"
                                    ></polyline>
                                </svg>
                            </button>
                        </div>
                    </div>
                {:else}
                    <button
                        class="text-accent w-full px-2.5 py-1.5 text-left text-[11px] transition-colors hover:bg-[rgba(255,255,255,0.06)]"
                        onclick={e => {
                            e.stopPropagation();
                            creating = true;
                        }}>+ New label</button
                    >
                {/if}
            </div>
        </div>
    {/if}
</div>
