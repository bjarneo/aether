<script lang="ts">
    import type {Snippet} from 'svelte';
    import {tick} from 'svelte';

    let {
        open,
        onclose,
        onenter,
        panelClass = 'w-80',
        z = 'z-50',
        children,
    }: {
        open: boolean;
        onclose: () => void;
        onenter?: () => void;
        panelClass?: string;
        z?: string;
        children: Snippet;
    } = $props();

    let panelEl = $state<HTMLDivElement | null>(null);

    // Anything tabbable inside the dialog.
    const FOCUSABLE =
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    $effect(() => {
        if (!open) return;
        // Remember what had focus so it can be restored on close.
        const trigger = document.activeElement as HTMLElement | null;

        // Pull focus into the dialog once mounted, unless a child already
        // grabbed it (e.g. ConfirmDialog focuses its confirm button,
        // SaveDialog its name input). Focus the panel itself rather than the
        // first control so Enter still means "confirm", not "Cancel".
        tick().then(() => {
            if (!panelEl || panelEl.contains(document.activeElement)) return;
            panelEl.focus();
        });

        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onclose();
            } else if (e.key === 'Enter' && onenter) {
                // Let a focused button/textarea/link handle its own Enter;
                // only treat Enter as "confirm" from an input or the panel.
                const tag = (
                    document.activeElement?.tagName ?? ''
                ).toLowerCase();
                if (tag !== 'button' && tag !== 'textarea' && tag !== 'a') {
                    e.preventDefault();
                    onenter();
                }
            } else if (e.key === 'Tab' && panelEl) {
                // Trap Tab within the dialog so focus can't reach the
                // obscured UI behind the scrim.
                const items = Array.from(
                    panelEl.querySelectorAll<HTMLElement>(FOCUSABLE)
                ).filter(el => el.offsetParent !== null);
                if (items.length === 0) {
                    e.preventDefault();
                    panelEl.focus();
                    return;
                }
                const first = items[0];
                const last = items[items.length - 1];
                const active = document.activeElement as HTMLElement;
                if (
                    e.shiftKey &&
                    (active === first ||
                        active === panelEl ||
                        !panelEl.contains(active))
                ) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && active === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('keydown', onKey);
            // Restore focus to whatever opened the dialog.
            if (trigger && typeof trigger.focus === 'function') trigger.focus();
        };
    });
</script>

{#if open}
    <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
    <div
        class="fixed inset-0 {z} flex items-center justify-center bg-black/45"
        onclick={e => {
            if (e.target === e.currentTarget) onclose();
        }}
        role="presentation"
    >
        <div
            bind:this={panelEl}
            class="bg-bg-secondary border-border {panelClass} max-w-[90vw] border p-4 shadow-xl focus:outline-none"
            role="dialog"
            aria-modal="true"
            tabindex="-1"
        >
            {@render children()}
        </div>
    </div>
{/if}
