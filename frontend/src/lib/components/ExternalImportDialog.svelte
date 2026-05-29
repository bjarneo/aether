<script lang="ts">
    import Modal from '$lib/components/shared/Modal.svelte';
    import {showToast, setActiveTab} from '$lib/stores/ui.svelte';
    import {
        loadFullImage,
        getCachedFullImage,
    } from '$lib/stores/imagecache.svelte';
    import {
        ConfirmExternalImport,
        OpenExternalImportInEditor,
        CancelExternalImport,
        GetPendingExternalImport,
    } from '../../../wailsjs/go/main/App';
    import {EventsOn} from '../../../wailsjs/runtime/runtime';
    import {onMount} from 'svelte';

    type Preview = {
        has_external_theme: boolean;
        has_colors: boolean;
        has_wallpaper: boolean;
        source_url: string;
        palette?: string[];
        wallpaper?: string;
        theme_name?: string;
        mode?: string;
        edit?: boolean;
    };

    let preview = $state<Preview | null>(null);
    let wallpaperDataUrl = $state('');
    let isApplying = $state(false);
    // edit=true imports load into the editor instead of applying.
    let isEdit = $derived(!!preview?.edit);

    onMount(() => {
        // The backend emits this on startup when a staged file is present,
        // and on each IPC pending-import while the GUI is already running.
        const cleanup = EventsOn('external-import-requested', (p: Preview) => {
            preview = p;
            primeWallpaper(p);
        });
        // Also pull on mount in case the event fired before we subscribed.
        GetPendingExternalImport().then(p => {
            if (p) {
                preview = p as Preview;
                primeWallpaper(preview);
            }
        });
        return cleanup;
    });

    async function primeWallpaper(p: Preview | null) {
        wallpaperDataUrl = '';
        if (!p?.wallpaper) return;
        const cached = getCachedFullImage(p.wallpaper);
        if (cached) {
            wallpaperDataUrl = cached;
            return;
        }
        try {
            wallpaperDataUrl = await loadFullImage(p.wallpaper);
        } catch {
            wallpaperDataUrl = '';
        }
    }

    let assetKind = $derived(() => {
        if (!preview) return '';
        const parts: string[] = [];
        if (preview.has_external_theme) parts.push('External theme');
        else if (preview.has_colors && preview.has_wallpaper)
            parts.push('Colors + wallpaper');
        else if (preview.has_colors) parts.push('Colors');
        else if (preview.has_wallpaper) parts.push('Wallpaper');
        else parts.push('Theme');
        if (preview.mode === 'light') parts.push('light mode');
        else if (preview.mode === 'dark') parts.push('dark mode');
        return parts.join(' · ');
    });

    let displayHost = $derived(() => {
        if (!preview?.source_url) return '';
        try {
            const u = new URL(preview.source_url);
            return u.searchParams
                .toString()
                .replace(/&/g, '\n')
                .replace(/=/g, ' = ');
        } catch {
            return preview.source_url;
        }
    });

    // edit=true links load the colors + wallpaper into the editor without
    // applying, so the user can tweak before hitting Apply themselves. Any
    // other link applies the theme immediately on confirm.
    async function handleConfirm() {
        if (!preview) return;
        const edit = isEdit; // snapshot before the await nulls preview
        isApplying = true;
        try {
            if (edit) {
                await OpenExternalImportInEditor();
                setActiveTab('editor');
                showToast('Loaded into editor');
            } else {
                await ConfirmExternalImport();
                showToast('Applied');
            }
            preview = null;
        } catch (err) {
            showToast(edit ? 'Failed to load' : 'Failed to apply');
            // eslint-disable-next-line no-console
            console.error('external-import confirm:', err);
        } finally {
            isApplying = false;
        }
    }

    async function handleCancel() {
        try {
            await CancelExternalImport();
        } catch {
            // best-effort
        }
        preview = null;
    }
</script>

<Modal
    open={preview !== null}
    onclose={handleCancel}
    onenter={handleConfirm}
    panelClass="w-[420px]"
    z="z-50"
>
    {#if preview}
        <h3 class="text-fg-primary mb-1 text-[13px] font-medium">
            {isEdit
                ? 'Open theme from web in editor?'
                : 'Apply theme from web?'}
        </h3>
        <p class="text-fg-dimmed mb-3 text-[10px] uppercase tracking-wider">
            {assetKind()}
        </p>

        {#if preview.palette && preview.palette.length > 0}
            <div class="border-border mb-3 grid grid-cols-8 gap-0 border">
                {#each preview.palette.slice(0, 16) as color, i (i)}
                    <div
                        class="h-6"
                        style="background:{color || 'transparent'}"
                        title={color}
                    ></div>
                {/each}
            </div>
        {/if}

        {#if preview.has_wallpaper && wallpaperDataUrl}
            <div class="border-border mb-3 border">
                <img
                    src={wallpaperDataUrl}
                    alt="Wallpaper preview"
                    class="block h-32 w-full object-cover"
                />
            </div>
        {/if}

        {#if preview.theme_name}
            <p class="text-fg-secondary mb-2 text-[11px]">
                Name: <span class="text-fg-primary">{preview.theme_name}</span>
            </p>
        {/if}

        <p
            class="text-fg-dimmed mb-3 whitespace-pre-line break-all text-[10px]"
        >
            {displayHost()}
        </p>

        <p class="text-fg-dimmed mb-4 text-[10px]">
            {#if isEdit}
                Aether will load these colors and wallpaper into the editor.
                Nothing is applied until you click Apply.
            {:else}
                Aether will replace your palette and background. Only apply from
                sources you trust.
            {/if}
        </p>

        <div class="flex justify-end gap-2">
            <button
                class="text-fg-dimmed hover:text-fg-secondary px-3 py-1.5 text-[11px]"
                onclick={handleCancel}
                disabled={isApplying}
            >
                Cancel
            </button>
            <button
                class="bg-accent hover:bg-accent-hover text-accent-fg px-3 py-1.5 text-[11px] font-medium disabled:opacity-50"
                onclick={handleConfirm}
                disabled={isApplying}
            >
                {#if isEdit}
                    {isApplying ? 'Opening...' : 'Open in editor'}
                {:else}
                    {isApplying ? 'Applying...' : 'Apply'}
                {/if}
            </button>
        </div>
    {/if}
</Modal>
