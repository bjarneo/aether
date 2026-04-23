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
    }: {
        label: string;
        value: number;
        max: number;
        step?: number | string;
        display: string;
        gradient: string;
        disabled?: boolean;
        onchange: (value: number) => void;
    } = $props();

    let percent = $derived((value / max) * 100);
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
        <!-- Thumb: white bar with subtle dark ring + drop shadow so it's legible
             on any gradient. Offset by half its width so the value position is
             dead-center of the bar, not at its left edge. -->
        <div
            class="pointer-events-none absolute inset-y-[-1px] w-[3px] bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.4),0_1px_3px_rgba(0,0,0,0.35)] transition-[width] group-hover:w-1"
            style:left="calc({percent}% - 1.5px)"
        ></div>
    </div>

    <span
        class="text-fg-dimmed w-12 text-right font-mono text-[10px] tabular-nums"
        >{display}</span
    >
</div>
