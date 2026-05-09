<script lang="ts">
    import Modal from './Modal.svelte';

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
            if (e.key === 'Enter') {
                e.preventDefault();
                onconfirm();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });
</script>

<Modal {open} onclose={oncancel}>
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
</Modal>
