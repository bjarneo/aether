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
        if (open) confirmEl?.focus();
    });
</script>

<Modal {open} onclose={oncancel} onenter={onconfirm}>
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
            class="text-fg-dimmed hover:text-fg-secondary px-3 py-1 text-[11px] transition-colors"
            onclick={oncancel}>{cancelLabel}</button
        >
        <button
            type="button"
            bind:this={confirmEl}
            class="px-3 py-1 text-[11px] font-medium transition-colors {danger
                ? 'bg-destructive hover:bg-destructive/85 text-white'
                : 'bg-accent hover:bg-accent-hover text-accent-fg'}"
            onclick={onconfirm}>{confirmLabel}</button
        >
    </div>
</Modal>
