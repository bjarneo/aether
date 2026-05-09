<script lang="ts">
    let {
        open,
        title,
        body,
        confirmLabel = 'Confirm',
        cancelLabel = 'Cancel',
        danger = false,
        onconfirm,
        oncancel,
    }: {
        open: boolean;
        title: string;
        body?: string;
        confirmLabel?: string;
        cancelLabel?: string;
        danger?: boolean;
        onconfirm: () => void;
        oncancel: () => void;
    } = $props();

    let confirmEl = $state<HTMLButtonElement | null>(null);

    $effect(() => {
        if (!open) return;
        confirmEl?.focus();
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                oncancel();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                onconfirm();
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
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        onclick={e => {
            if (e.target === e.currentTarget) oncancel();
        }}
    >
        <div
            class="bg-bg-secondary border-border w-80 max-w-[90vw] border p-4 shadow-xl"
            role="dialog"
            aria-modal="true"
        >
            <h3 class="text-fg-primary mb-1.5 text-[12px] font-medium">
                {title}
            </h3>
            {#if body}
                <p class="text-fg-dimmed mb-4 text-[11px] leading-relaxed">
                    {body}
                </p>
            {/if}
            <div class="flex justify-end gap-2">
                <button
                    type="button"
                    class="text-fg-secondary border-border hover:bg-bg-hover border px-3 py-1 text-[11px] transition-colors"
                    onclick={oncancel}>{cancelLabel}</button
                >
                <button
                    type="button"
                    bind:this={confirmEl}
                    class="px-3 py-1 text-[11px] font-medium transition-colors {danger
                        ? 'bg-destructive hover:bg-destructive/85 text-white'
                        : 'bg-accent hover:bg-accent-hover text-[#111116]'}"
                    onclick={onconfirm}>{confirmLabel}</button
                >
            </div>
        </div>
    </div>
{/if}
