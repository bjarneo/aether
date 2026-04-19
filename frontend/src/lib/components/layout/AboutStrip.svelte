<script lang="ts">
    import {openURL} from '$lib/utils/browser';
</script>

<div
    class="bg-bg-secondary border-border text-fg-dimmed flex h-6 shrink-0 items-center justify-between border-t px-3 text-[10px]"
>
    <div class="flex items-center gap-2">
        <span>v{__APP_VERSION__}</span>
    </div>
    <div class="flex items-center gap-3">
        <button
            class="hover:text-accent transition-colors duration-100"
            onclick={() => openURL('https://github.com/bjarneo/aether')}
            title="Open GitHub repository">GitHub</button
        >
        <button
            class="hover:text-accent transition-colors duration-100"
            onclick={() => openURL('https://x.com/iamdothash')}
            title="Open X / Twitter profile">X / Twitter</button
        >
    </div>
</div>
