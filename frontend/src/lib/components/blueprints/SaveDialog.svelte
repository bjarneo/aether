<script lang="ts">
    import {showToast} from '$lib/stores/ui.svelte';
    import {
        getPalette,
        getWallpaperPath,
        getLightMode,
        getAdditionalImages,
        getExtendedColors,
        getAppOverrides,
        getAdjustments,
    } from '$lib/stores/theme.svelte';
    import Modal from '$lib/components/shared/Modal.svelte';

    let {
        open = true,
        onclose,
        onsave,
    }: {open?: boolean; onclose: () => void; onsave: () => void} = $props();
    let name = $state('');
    let isSaving = $state(false);
    let showOverrideConfirm = $state(false);
    let nameInput = $state<HTMLInputElement | null>(null);
    let attemptedSubmit = $state(false);

    $effect(() => {
        if (open && !showOverrideConfirm) nameInput?.focus();
    });

    let nameError = $derived(
        attemptedSubmit && !name.trim() ? 'Theme name is required' : ''
    );

    // Esc/backdrop dismissal goes through Modal's onclose, which we override
    // to step back from the override-confirm sub-panel before fully closing.
    function handleClose() {
        if (showOverrideConfirm) {
            showOverrideConfirm = false;
        } else {
            onclose();
        }
    }

    function handleEnter() {
        if (!showOverrideConfirm) handleSave();
    }

    async function handleSave() {
        attemptedSubmit = true;
        if (!name.trim()) {
            nameInput?.focus();
            return;
        }
        isSaving = true;
        try {
            const {BlueprintExists} = await import(
                '../../../../wailsjs/go/main/App'
            );
            const exists = await BlueprintExists(name.trim());
            if (exists && !showOverrideConfirm) {
                showOverrideConfirm = true;
                isSaving = false;
                return;
            }
            await doSave();
        } catch {
            showToast('Failed to save');
            isSaving = false;
        }
    }

    async function doSave() {
        try {
            const {SaveBlueprint} = await import(
                '../../../../wailsjs/go/main/App'
            );
            await SaveBlueprint({
                name: name.trim(),
                palette: getPalette(),
                wallpaperPath: getWallpaperPath(),
                lightMode: getLightMode(),
                additionalImages: getAdditionalImages(),
                lockedColors: [],
                extendedColors: getExtendedColors(),
                appOverrides: getAppOverrides(),
                adjustments: {...getAdjustments()},
            });
            showToast(`Saved: ${name.trim()}`);
            onsave();
        } catch {
            showToast('Failed to save');
        } finally {
            isSaving = false;
        }
    }
</script>

<Modal {open} onclose={handleClose} onenter={handleEnter} z="z-40">
    {#if showOverrideConfirm}
        <h3 class="text-fg-primary mb-3 text-[12px] font-medium">
            Override existing theme?
        </h3>
        <p class="text-fg-dimmed mb-3 text-[11px]">
            A theme named "{name.trim()}" already exists.
        </p>
        <div class="flex justify-end gap-2">
            <button
                class="text-fg-dimmed hover:text-fg-secondary px-3 py-1.5 text-[11px]"
                onclick={() => (showOverrideConfirm = false)}>Cancel</button
            >
            <button
                class="bg-accent hover:bg-accent-hover text-accent-fg px-3 py-1.5 text-[11px] font-medium disabled:opacity-50"
                onclick={doSave}
                disabled={isSaving}
                >{isSaving ? 'Saving...' : 'Override'}</button
            >
        </div>
    {:else}
        <h3 class="text-fg-primary mb-3 text-[12px] font-medium">Save Theme</h3>
        <input
            bind:this={nameInput}
            type="text"
            class="bg-bg-surface text-fg-primary focus:border-border-focus w-full border px-2 py-1.5 text-[12px] outline-none {nameError
                ? 'border-destructive'
                : 'border-border'}"
            placeholder="Theme name..."
            bind:value={name}
            aria-invalid={!!nameError}
            aria-describedby={nameError ? 'save-name-error' : undefined}
        />
        {#if nameError}
            <p id="save-name-error" class="text-destructive mt-1 text-[10px]">
                {nameError}
            </p>
        {/if}
        <div class="mt-3 flex justify-end gap-2">
            <button
                class="text-fg-dimmed hover:text-fg-secondary px-3 py-1.5 text-[11px]"
                onclick={onclose}>Cancel</button
            >
            <button
                class="bg-accent hover:bg-accent-hover text-accent-fg px-3 py-1.5 text-[11px] font-medium disabled:opacity-50"
                onclick={handleSave}
                disabled={!name.trim() || isSaving}
                >{isSaving ? 'Saving...' : 'Save'}</button
            >
        </div>
    {/if}
</Modal>
