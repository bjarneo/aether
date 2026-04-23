<script lang="ts">
    let {
        label,
        value,
        max,
        step = 1,
        display,
        gradient,
        disabled = false,
        onchange,
        oncommit,
    }: {
        label: string;
        value: number;
        max: number;
        step?: number | string;
        display: string;
        gradient: string;
        disabled?: boolean;
        onchange: (value: number) => void;
        oncommit: (raw: string) => void;
    } = $props();

    let percent = $derived((value / max) * 100);

    let editing = $state(false);
    let editValue = $state('');
    let inputEl = $state<HTMLInputElement | null>(null);

    $effect(() => {
        if (editing && inputEl) {
            inputEl.focus();
            inputEl.select();
        }
    });

    function startEdit() {
        if (disabled) return;
        editValue = display;
        editing = true;
    }

    // Guarded so Enter's commit() doesn't double-fire when the subsequent
    // onblur (from the unmounting input) would otherwise run commit again.
    function commit() {
        if (!editing) return;
        oncommit(editValue);
        editing = false;
    }

    function handleKey(e: KeyboardEvent) {
        if (e.key === 'Enter') {
            e.preventDefault();
            commit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            editing = false;
        }
    }
</script>

<div class="flex items-center gap-2">
    <span class="text-fg-dimmed w-3 font-mono text-[10px]">{label}</span>

    <div
        class="border-border group relative h-4 flex-1 border"
        style:background={gradient}
    >
        <input
            type="range"
            class="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
            min="0"
            {max}
            {step}
            {value}
            oninput={e => onchange(parseFloat(e.currentTarget.value))}
            {disabled}
            aria-label={label}
            aria-valuetext={display}
        />
        <div
            class="pointer-events-none absolute inset-y-[-1px] w-[3px] bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.4),0_1px_3px_rgba(0,0,0,0.35)] transition-[width] group-hover:w-1"
            style:left="calc({percent}% - 1.5px)"
        ></div>
    </div>

    {#if editing}
        <input
            type="text"
            bind:this={inputEl}
            bind:value={editValue}
            onblur={commit}
            onkeydown={handleKey}
            spellcheck={false}
            class="text-fg-primary bg-bg-secondary border-accent w-12 border px-1 text-right font-mono text-[10px] tabular-nums outline-none"
        />
    {:else}
        <button
            type="button"
            class="text-fg-dimmed w-12 text-right font-mono text-[10px] tabular-nums transition-colors
                {disabled ? 'cursor-default' : 'hover:text-fg-primary'}"
            onclick={startEdit}
            {disabled}
            aria-label="Edit {label} value">{display}</button
        >
    {/if}
</div>
