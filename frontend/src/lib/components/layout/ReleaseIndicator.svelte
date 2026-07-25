<script lang="ts">
    import {onMount} from 'svelte';
    import {showToast} from '$lib/stores/ui.svelte';

    type ReleaseStatus = {
        currentVersion: string;
        latestVersion: string;
        releaseURL: string;
        updateAvailable: boolean;
    };

    type Status = 'checking' | 'current' | 'available' | 'error';

    let {isMac = false}: {isMac?: boolean} = $props();

    let status = $state<Status>('checking');
    let release = $state<ReleaseStatus | null>(null);
    let title = $derived(
        status === 'checking'
            ? 'Checking for Aether updates'
            : status === 'available'
              ? `Aether ${release?.latestVersion} is available. Click to upgrade`
              : status === 'current'
                ? `Aether ${release?.currentVersion} is up to date. Click to check again`
                : 'Could not check for updates. Click to try again'
    );
    let signalClass = $derived(
        status === 'available'
            ? 'bg-warning'
            : status === 'current'
              ? 'bg-success'
              : status === 'error'
                ? 'bg-destructive'
                : 'bg-accent animate-pulse'
    );

    async function refresh(): Promise<void> {
        if (status === 'checking') return;
        status = 'checking';
        try {
            const {GetReleaseStatus} = await import(
                '../../../../wailsjs/go/main/App'
            );
            release = (await GetReleaseStatus(
                __APP_VERSION__
            )) as ReleaseStatus;
            status = release.updateAvailable ? 'available' : 'current';
        } catch {
            status = 'error';
        }
    }

    async function handleClick(): Promise<void> {
        if (status !== 'available') {
            await refresh();
            return;
        }
        try {
            const {StartUpgrade} = await import(
                '../../../../wailsjs/go/main/App'
            );
            await StartUpgrade();
            showToast(
                'Upgrade opened in a terminal. Restart Aether when it completes.',
                6000
            );
        } catch {
            showToast('Could not open a terminal. Run: aether upgrade', 6000);
        }
    }

    onMount(() => {
        status = 'error';
        void refresh();
    });
</script>

<button
    type="button"
    class="text-fg-dimmed hover:bg-bg-hover relative flex h-7 w-7 items-center justify-center transition-colors"
    class:mb-0.5={isMac}
    onclick={handleClick}
    aria-label={title}
    {title}
>
    {#if status === 'available'}
        <span
            class="bg-warning absolute h-3.5 w-3.5 animate-ping opacity-45"
            style="border-radius: 9999px !important"
            aria-hidden="true"
        ></span>
    {/if}
    <span
        class="{signalClass} relative flex h-2.5 w-2.5 items-center justify-center"
        style="border-radius: 9999px !important"
        aria-hidden="true"
    >
        {#if status === 'available'}
            <svg
                class="h-2 w-2 text-[#111116]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <path d="M12 19V5M6 11l6-6 6 6"></path>
            </svg>
        {/if}
    </span>
</button>
