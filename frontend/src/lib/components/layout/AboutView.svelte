<script lang="ts">
    import {openURL} from '$lib/utils/browser';
    import omarchyIcon from '../../../assets/omarchy.png';

    type Link = {
        label: string;
        url: string;
        description: string;
        icon: string;
        image?: string;
    };

    const links: Link[] = [
        {
            label: 'GitHub',
            url: 'https://github.com/bjarneo/aether',
            description: 'Source code, issues, releases',
            icon: 'M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2c-3.2.7-3.87-1.36-3.87-1.36-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.34.95.1-.74.4-1.24.72-1.53-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.06 11.06 0 0 1 5.78 0c2.21-1.49 3.18-1.18 3.18-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.84 1.18 3.1 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.07.78 2.16v3.2c0 .31.21.68.8.56C20.21 21.39 23.5 17.07 23.5 12 23.5 5.65 18.35.5 12 .5Z',
        },
        {
            label: 'X / Twitter',
            url: 'https://x.com/iamdothash',
            description: "Author's X",
            icon: 'M18.244 2H21.5l-7.494 8.567L23 22h-6.793l-5.32-6.957L4.8 22H1.54l8.014-9.166L1 2h6.96l4.806 6.353L18.244 2Zm-2.378 18.16h1.84L7.21 3.74H5.236l10.63 16.42Z',
        },
        {
            label: 'Omarchy',
            url: 'https://omarchy.org',
            description: 'The Linux desktop Aether is built for',
            icon: '',
            image: omarchyIcon,
        },
    ];
</script>

<div class="mx-auto h-full max-w-2xl overflow-y-auto p-8">
    <div class="mb-8">
        <h1
            class="text-fg-primary mb-2 text-[24px] font-semibold tracking-tight"
            style="letter-spacing: 0.04em;"
        >
            AETHER
        </h1>
        <p class="text-fg-dimmed text-[12px]">
            Desktop theming for Linux · v{__APP_VERSION__}
        </p>
    </div>

    <p class="text-fg-secondary mb-8 text-[12px] leading-relaxed">
        Aether extracts colour palettes from wallpapers and applies cohesive
        themes across your Linux desktop. Built with Wails, Go, and Svelte 5.
    </p>

    <div class="mb-8">
        <h2
            class="text-fg-dimmed mb-3 text-[10px] font-medium uppercase tracking-wider"
        >
            Links
        </h2>
        <div class="flex flex-col gap-1">
            {#each links as link}
                <button
                    type="button"
                    class="border-border hover:border-border-focus hover:bg-bg-hover group flex items-center gap-3 border px-3 py-2.5 text-left transition-colors"
                    onclick={() => openURL(link.url)}
                >
                    {#if link.image}
                        <img
                            src={link.image}
                            alt=""
                            class="h-4 w-4 shrink-0 object-contain"
                            aria-hidden="true"
                        />
                    {:else}
                        <svg
                            class="text-fg-secondary group-hover:text-accent h-4 w-4 shrink-0 transition-colors"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            aria-hidden="true"
                        >
                            <path d={link.icon}></path>
                        </svg>
                    {/if}
                    <div class="min-w-0 flex-1">
                        <div class="text-fg-primary text-[12px] font-medium">
                            {link.label}
                        </div>
                        <div class="text-fg-dimmed truncate text-[10px]">
                            {link.description}
                        </div>
                    </div>
                    <svg
                        class="text-fg-dimmed group-hover:text-fg-secondary h-3.5 w-3.5 shrink-0 transition-colors"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true"
                    >
                        <path d="M7 17L17 7M17 7H8M17 7v9"></path>
                    </svg>
                </button>
            {/each}
        </div>
    </div>

    <div class="mb-8">
        <h2
            class="text-fg-dimmed mb-3 text-[10px] font-medium uppercase tracking-wider"
        >
            Author
        </h2>
        <p class="text-fg-secondary text-[12px]">
            Built by <span class="text-fg-primary">Bjarne Øverli</span>
        </p>
    </div>

    <p class="text-fg-dimmed text-[10px]">
        © {new Date().getFullYear()} · MIT License
    </p>
</div>
