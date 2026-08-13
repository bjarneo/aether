<script lang="ts">
    let {
        label,
        value,
        min = 0,
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
        min?: number;
        max: number;
        step?: number;
        display: string;
        gradient: string;
        disabled?: boolean;
        onchange: (value: number) => void;
        oncommit: (raw: string) => void;
    } = $props();

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
        const raw = editValue;
        editing = false;
        oncommit(raw);
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

<div class="flex min-h-6 items-center gap-2">
    <span class="text-fg-dimmed w-3 font-mono text-[10px]">{label}</span>

    <div
        class="border-border focus-within:border-accent group relative h-5 flex-1 border transition-colors
            {disabled ? 'opacity-50' : ''}"
        style:background={gradient}
    >
        <input
            type="range"
            class="channel-input absolute inset-0 w-full cursor-pointer disabled:cursor-not-allowed"
            {min}
            {max}
            {step}
            {value}
            oninput={e => onchange(parseFloat(e.currentTarget.value))}
            {disabled}
            aria-label={label}
            aria-valuetext={display}
        />
    </div>

    {#if editing}
        <input
            type="text"
            bind:this={inputEl}
            bind:value={editValue}
            onblur={commit}
            onkeydown={handleKey}
            spellcheck={false}
            inputmode="decimal"
            aria-label="Edit {label} value"
            class="text-fg-primary bg-bg-secondary border-accent h-5 w-14 border px-1 text-right font-mono text-[10px] tabular-nums outline-none"
        />
    {:else}
        <button
            type="button"
            class="text-fg-dimmed h-5 w-14 text-right font-mono text-[10px] tabular-nums transition-colors
                {disabled ? 'cursor-default' : 'hover:text-fg-primary'}"
            onclick={startEdit}
            {disabled}
            aria-label="Edit {label} value">{display}</button
        >
    {/if}
</div>

<style>
    .channel-input {
        -webkit-appearance: none;
        appearance: none;
        height: 100%;
        margin: 0;
        touch-action: none;
        background: transparent;
        outline: none;
    }

    .channel-input::-webkit-slider-runnable-track {
        height: 100%;
        border: 0;
        background: transparent;
    }

    .channel-input::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 5px;
        height: 20px;
        margin: -1px 0 0;
        border: 1px solid rgba(0, 0, 0, 0.55);
        background: #fff;
        box-shadow:
            0 0 0 1px rgba(255, 255, 255, 0.45),
            0 1px 4px rgba(0, 0, 0, 0.45);
    }

    .channel-input:hover::-webkit-slider-thumb,
    .channel-input:focus-visible::-webkit-slider-thumb {
        box-shadow:
            0 0 0 1px rgba(255, 255, 255, 0.8),
            0 0 0 2px rgba(0, 0, 0, 0.55),
            0 1px 5px rgba(0, 0, 0, 0.5);
    }

    .channel-input::-moz-range-track {
        height: 100%;
        border: 0;
        background: transparent;
    }

    .channel-input::-moz-range-thumb {
        width: 3px;
        height: 18px;
        border: 1px solid rgba(0, 0, 0, 0.55);
        border-radius: 0;
        background: #fff;
        box-shadow:
            0 0 0 1px rgba(255, 255, 255, 0.45),
            0 1px 4px rgba(0, 0, 0, 0.45);
    }
</style>
