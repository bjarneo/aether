<script lang="ts">
    import {getWallpaperPath} from '$lib/stores/theme.svelte';
    import {debounce} from '$lib/utils/debounce';
    import Modal from '$lib/components/shared/Modal.svelte';

    let {
        open,
        onsave,
        onclose,
    }: {
        open: boolean;
        onsave: (name: string, updateExisting: boolean) => void;
        onclose: () => void;
    } = $props();

    let name = $state('');
    let folderExists = $state(false);
    let nameInput = $state<HTMLInputElement | null>(null);

    const validName = (value: string) => /^[a-z0-9][a-z0-9-]*$/.test(value);

    function suggestedName() {
        const fileName = getWallpaperPath().split(/[\\/]/).pop() ?? '';
        const base = fileName.replace(/\.[^.]+$/, '');
        const suggestion = base
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        return validName(suggestion) ? suggestion : 'theme';
    }

    // Existing folders are updated in place rather than refusing to save,
    // so the dialog reflects that while typing.
    const checkExists = debounce(async (value: string) => {
        if (!open || !validName(value)) {
            folderExists = false;
            return;
        }
        try {
            const {ThemeFolderExists} =
                await import('../../../../wailsjs/go/main/App');
            // Ignore stale responses if the name changed mid-flight.
            const exists = await ThemeFolderExists(value);
            if (name === value) folderExists = exists;
        } catch {
            folderExists = false;
        }
    }, 250);

    $effect(() => {
        if (!open) {
            name = '';
            folderExists = false;
            return;
        }
        if (!name) name = suggestedName();
        checkExists(name);
        nameInput?.focus();
    });

    function saveAndApply() {
        const normalized = name.trim().toLowerCase();
        if (!validName(normalized)) {
            nameInput?.focus();
            return;
        }
        onsave(normalized, folderExists);
    }
</script>

<Modal {open} {onclose} onenter={saveAndApply}>
    <h3 class="text-fg-primary mb-2 text-[12px] font-medium">
        {folderExists ? 'Update Theme Folder' : 'Save as New Theme Folder'}
    </h3>
    <p class="text-fg-dimmed mb-3 text-[11px] leading-relaxed">
        Suggested from the wallpaper filename. Use lowercase letters, digits,
        and hyphens.
    </p>
    <input
        bind:this={nameInput}
        type="text"
        class="bg-bg-surface text-fg-primary focus:border-border-focus w-full border px-2 py-1.5 text-[12px] outline-none {name &&
        !validName(name)
            ? 'border-destructive'
            : 'border-border'}"
        placeholder="e.g. midnight-blue-2"
        bind:value={name}
        oninput={() => {
            name = name.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
            checkExists(name);
        }}
        aria-label="Theme folder name"
    />
    {#if folderExists}
        <p class="text-warning mt-2 text-[11px]">
            Folder exists — it will be updated with the current colors and
            wallpapers.
        </p>
    {/if}
    <div class="mt-3 flex justify-end gap-2">
        <button
            type="button"
            class="text-fg-dimmed hover:text-fg-secondary px-3 py-1.5 text-[11px] transition-colors"
            onclick={onclose}>Cancel</button
        >
        <button
            type="button"
            class="bg-accent hover:bg-accent-hover text-accent-fg px-3 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-50"
            onclick={saveAndApply}
            disabled={!validName(name)}
        >
            {folderExists ? 'Update and Apply' : 'Save and Apply'}
        </button>
    </div>
</Modal>
