<script lang="ts">
    let {
        label,
        value,
        min,
        max,
        step,
        defaultValue,
        oninput,
        oncommit,
    }: {
        label: string;
        value: number;
        min: number;
        max: number;
        step: number;
        defaultValue: number;
        oninput: (value: number) => void;
        oncommit?: () => void;
    } = $props();

    let editing = $state(false);
    let editValue = $state('');

    function handleDblClick() {
        oninput(defaultValue);
        oncommit?.();
    }

    function startEdit() {
        editValue = step < 1 ? value.toFixed(1) : String(value);
        editing = true;
    }

    function commitEdit() {
        editing = false;
        const num = parseFloat(editValue);
        if (!isNaN(num)) {
            oninput(Math.max(min, Math.min(max, num)));
            oncommit?.();
        }
    }

    function handleEditKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter') commitEdit();
        if (e.key === 'Escape') editing = false;
    }
</script>

<div class="flex flex-col gap-0.5">
    <!-- Label + value row -->
    <div class="flex items-center justify-between">
        <span class="text-fg-secondary text-[11px]">{label}</span>

        {#if editing}
            <div class="flex items-center gap-1">
                <input
                    type="text"
                    class="text-fg-primary bg-bg-surface border-accent w-10 border px-1 py-0 text-right font-mono text-[10px] outline-none"
                    bind:value={editValue}
                    onblur={commitEdit}
                    onkeydown={handleEditKeydown}
                    autofocus
                />
                <button
                    class="text-accent hover:text-accent-hover text-[10px]"
                    onclick={commitEdit}
                    title="Apply"
                >
                    <svg
                        class="h-3 w-3"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </button>
            </div>
        {:else}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <span
                class="cursor-text font-mono text-[10px]
          {value !== defaultValue
                    ? 'text-fg-secondary hover:text-accent'
                    : 'text-fg-dimmed hover:text-fg-secondary'}"
                role="button"
                tabindex="-1"
                onclick={startEdit}
                ondblclick={handleDblClick}
                title="Click to type · Double-click to reset"
            >
                {step < 1 ? value.toFixed(1) : value}
            </span>
        {/if}
    </div>

    <!-- Slider -->
    <input
        type="range"
        class="w-full cursor-pointer"
        {min}
        {max}
        {step}
        {value}
        oninput={e => oninput(parseFloat(e.currentTarget.value))}
        onchange={() => oncommit?.()}
        ondblclick={handleDblClick}
        title="Double-click to reset"
    />
</div>
