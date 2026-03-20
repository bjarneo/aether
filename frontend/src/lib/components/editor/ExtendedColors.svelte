<script lang="ts">
    import {
        getExtendedColors,
        setExtendedColor,
        getSelectedExtColors,
        toggleExtColorSelection,
    } from '$lib/stores/theme.svelte';
    import {openExtendedColorPicker} from '$lib/stores/ui.svelte';
    import {isLightColor, copyColor} from '$lib/utils/color';
    import {EXTENDED_COLOR_ROLES} from '$lib/constants/colors';
    import LockIcon from '$lib/components/shared/LockIcon.svelte';

    let extColors = $derived(getExtendedColors());
    let selectedExt = $derived(getSelectedExtColors());

    let lockedExt = $state<Record<string, boolean>>({});

    function toggleLock(key: string, event: MouseEvent) {
        event.stopPropagation();
        event.preventDefault();
        lockedExt = {...lockedExt, [key]: !lockedExt[key]};
    }
</script>

<div class="mt-4">
    <h3
        class="text-fg-dimmed mb-2 text-[10px] font-medium uppercase tracking-wider"
    >
        Extended Colors
    </h3>
    <div class="grid grid-cols-4 gap-2">
        {#each EXTENDED_COLOR_ROLES as role}
            {@const hex = extColors[role.key] || '#000000'}
            {@const locked = lockedExt[role.key] || false}
            {@const sel = selectedExt[role.key] || false}
            {@const light = isLightColor(hex)}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="flex flex-col gap-1">
                <div
                    class="group relative h-10 overflow-hidden border transition-all duration-150
            {locked
                        ? 'cursor-default border-[rgba(255,255,255,0.03)]'
                        : sel
                          ? 'border-accent cursor-pointer border-2'
                          : 'hover:border-accent cursor-pointer border-[rgba(255,255,255,0.06)] hover:z-10 hover:scale-[1.04]'}"
                    style:background-color={hex}
                    onclick={e => {
                        if (e.ctrlKey || e.metaKey) {
                            e.preventDefault();
                            copyColor(hex);
                        } else if (e.shiftKey) {
                            e.preventDefault();
                            toggleExtColorSelection(role.key);
                        } else if (!locked) openExtendedColorPicker(role.key);
                    }}
                >
                    {#if sel}
                        <span
                            class="bg-accent absolute bottom-0.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2"
                        ></span>
                    {/if}
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <span
                        class="absolute right-0.5 top-0.5 z-10 flex h-5 w-5 cursor-pointer items-center justify-center
              {locked
                            ? light
                                ? 'text-black/60 hover:text-black'
                                : 'text-white/60 hover:text-white'
                            : 'opacity-0 transition-opacity hover:!opacity-100 group-hover:opacity-30 ' +
                              (light ? 'text-black' : 'text-white')}"
                        role="button"
                        tabindex="-1"
                        onclick={e => toggleLock(role.key, e)}
                    >
                        <LockIcon {locked} size="w-3 h-3" />
                    </span>

                    <span
                        class="absolute inset-0 flex items-center justify-center font-mono text-[10px]
            opacity-0 transition-opacity group-hover:opacity-100
            {light ? 'text-black/80' : 'text-white/80'}"
                        style="text-shadow: 0 1px 3px {light
                            ? 'rgba(255,255,255,0.3)'
                            : 'rgba(0,0,0,0.5)'}"
                    >
                        {hex}
                    </span>
                </div>
                <span class="text-fg-dimmed text-center text-[9px]"
                    >{role.label}</span
                >
            </div>
        {/each}
    </div>
</div>
