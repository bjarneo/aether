<script lang="ts">
    import {showToast} from '$lib/stores/ui.svelte';
    import {
        getPalette,
        getWallpaperPath,
        getLightMode,
        getAdditionalImages,
        getExtendedColors,
        getAppOverrides,
    } from '$lib/stores/theme.svelte';

    let {onclose, onsave}: {onclose: () => void; onsave: () => void} = $props();
    let name = $state('');
    let isSaving = $state(false);

    async function handleSave() {
        if (!name.trim()) return;
        isSaving = true;
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
            });
            showToast(`Saved: ${name.trim()}`);
            onsave();
        } catch {
            showToast('Failed to save');
        } finally {
            isSaving = false;
        }
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') onclose();
    }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="fixed inset-0 z-40 flex items-center justify-center bg-black/40"
    onclick={e => {
        if (e.target === e.currentTarget) onclose();
    }}
>
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
        class="bg-bg-secondary border-border w-80 border p-4 shadow-xl"
        onkeydown={handleKeydown}
    >
        <h3 class="text-fg-primary mb-3 text-[12px] font-medium">Save Theme</h3>
        <input
            type="text"
            class="bg-bg-surface border-border text-fg-primary focus:border-border-focus mb-3 w-full border px-2 py-1.5 text-[12px] outline-none"
            placeholder="Theme name..."
            bind:value={name}
        />
        <div class="flex justify-end gap-2">
            <button
                class="text-fg-dimmed hover:text-fg-secondary px-3 py-1.5 text-[11px]"
                onclick={onclose}>Cancel</button
            >
            <button
                class="bg-accent hover:bg-accent-hover px-3 py-1.5 text-[11px] font-medium text-[#111116] disabled:opacity-50"
                onclick={handleSave}
                disabled={!name.trim() || isSaving}
                >{isSaving ? 'Saving...' : 'Save'}</button
            >
        </div>
    </div>
</div>
