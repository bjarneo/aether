<script lang="ts">
    import {setWallpaperPath} from '$lib/stores/theme.svelte';
    import {showToast, setActiveTab} from '$lib/stores/ui.svelte';

    async function handleBrowse() {
        try {
            const {OpenFileDialog} = await import(
                '../../../../wailsjs/go/main/App'
            );
            const path = await OpenFileDialog();
            if (path) {
                setWallpaperPath(path);
                showToast('Wallpaper selected');
            }
        } catch {}
    }
</script>

<div
    class="bg-bg-surface border-border mb-1 flex items-center gap-2 border p-3"
>
    <span class="text-fg-dimmed flex-1 text-[11px]">No wallpaper selected</span>
    <button
        class="bg-accent hover:bg-accent-hover px-3 py-1 text-[10px] font-medium text-[#111116] transition-colors"
        onclick={handleBrowse}>Browse</button
    >
    <button
        class="text-fg-secondary border-border hover:bg-bg-elevated border px-3 py-1 text-[10px] transition-colors"
        onclick={() => setActiveTab('wallhaven')}>Wallhaven</button
    >
    <button
        class="text-fg-secondary border-border hover:bg-bg-elevated border px-3 py-1 text-[10px] transition-colors"
        onclick={() => setActiveTab('local')}>Local</button
    >
</div>
