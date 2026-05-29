<script lang="ts">
    import type {Snippet} from 'svelte';

    let {
        icon,
        title,
        body,
        actionLabel,
        onaction,
        secondaryLabel,
        onsecondary,
    }: {
        icon?: Snippet;
        title: string;
        body?: string;
        actionLabel?: string;
        onaction?: () => void;
        secondaryLabel?: string;
        onsecondary?: () => void;
    } = $props();
</script>

<div class="flex h-full flex-col items-center justify-center p-8 text-center">
    {#if icon}
        <div class="text-fg-dimmed mb-3 opacity-50">{@render icon()}</div>
    {/if}
    <h3 class="text-fg-primary mb-1.5 text-[13px] font-medium">{title}</h3>
    {#if body}
        <p
            class="text-fg-dimmed mb-4 max-w-[340px] text-[11px] leading-relaxed"
        >
            {body}
        </p>
    {/if}
    {#if actionLabel && onaction}
        <div class="flex items-center gap-2">
            <button
                type="button"
                class="bg-accent hover:bg-accent-hover text-accent-fg px-3 py-1.5 text-[11px] font-medium transition-colors"
                onclick={onaction}>{actionLabel}</button
            >
            {#if secondaryLabel && onsecondary}
                <button
                    type="button"
                    class="text-fg-secondary border-border hover:bg-bg-hover border px-3 py-1.5 text-[11px] transition-colors"
                    onclick={onsecondary}>{secondaryLabel}</button
                >
            {/if}
        </div>
    {/if}
</div>
