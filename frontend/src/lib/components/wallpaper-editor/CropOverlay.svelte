<script lang="ts">
    import {onMount, onDestroy} from 'svelte';

    let {
        imgEl,
        containerEl,
        cropX,
        cropY,
        cropW,
        cropH,
        aspectRatio = 0,
        naturalWidth,
        naturalHeight,
        oncrop,
    }: {
        imgEl: HTMLImageElement;
        containerEl: HTMLElement;
        cropX: number;
        cropY: number;
        cropW: number;
        cropH: number;
        aspectRatio: number;
        naturalWidth: number;
        naturalHeight: number;
        oncrop: (x: number, y: number, w: number, h: number) => void;
    } = $props();

    // Local crop state for smooth dragging
    let lx = $state(0);
    let ly = $state(0);
    let lw = $state(1);
    let lh = $state(1);
    let isDragging = $state(false);

    $effect(() => {
        if (!isDragging) {
            lx = cropX;
            ly = cropY;
            lw = cropW;
            lh = cropH;
        }
    });

    // Image display rect relative to container
    let imgRect = $state({left: 0, top: 0, width: 0, height: 0});

    function updateImgRect() {
        if (!imgEl || !containerEl) return;
        const ir = imgEl.getBoundingClientRect();
        const cr = containerEl.getBoundingClientRect();
        imgRect = {
            left: ir.left - cr.left,
            top: ir.top - cr.top,
            width: ir.width,
            height: ir.height,
        };
    }

    let observer: ResizeObserver;
    onMount(() => {
        updateImgRect();
        observer = new ResizeObserver(updateImgRect);
        observer.observe(containerEl);
    });
    onDestroy(() => {
        observer?.disconnect();
        // Clean up drag listeners if destroyed mid-drag
        window.removeEventListener('mousemove', onDrag);
        window.removeEventListener('mouseup', endDrag);
    });

    $effect(() => {
        const el = imgEl;
        if (el) {
            updateImgRect();
            const handler = () => updateImgRect();
            el.addEventListener('load', handler);
            return () => el.removeEventListener('load', handler);
        }
    });

    // Crop rect in pixel coords
    let cpx = $derived({
        left: imgRect.left + lx * imgRect.width,
        top: imgRect.top + ly * imgRect.height,
        width: lw * imgRect.width,
        height: lh * imgRect.height,
    });

    // Normalized aspect ratio (in 0-1 coordinate space)
    let normRatio = $derived(
        aspectRatio > 0 && naturalWidth > 0 && naturalHeight > 0
            ? (aspectRatio * naturalHeight) / naturalWidth
            : 0
    );

    type Handle = 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';
    let dragHandle = $state<Handle | null>(null);
    let dragStart = {mx: 0, my: 0, x: 0, y: 0, w: 0, h: 0};

    function startDrag(e: MouseEvent, handle: Handle) {
        e.preventDefault();
        e.stopPropagation();
        isDragging = true;
        dragHandle = handle;
        dragStart = {
            mx: e.clientX,
            my: e.clientY,
            x: lx,
            y: ly,
            w: lw,
            h: lh,
        };
        window.addEventListener('mousemove', onDrag);
        window.addEventListener('mouseup', endDrag);
    }

    function clamp(v: number, min: number, max: number) {
        return Math.max(min, Math.min(max, v));
    }

    function onDrag(e: MouseEvent) {
        if (!dragHandle || imgRect.width === 0 || imgRect.height === 0) return;

        const dx = (e.clientX - dragStart.mx) / imgRect.width;
        const dy = (e.clientY - dragStart.my) / imgRect.height;
        const {x, y, w, h} = dragStart;
        const min = 0.02;

        if (dragHandle === 'move') {
            lx = clamp(x + dx, 0, 1 - w);
            ly = clamp(y + dy, 0, 1 - h);
            lw = w;
            lh = h;
            return;
        }

        let nx = x,
            ny = y,
            nw = w,
            nh = h;

        switch (dragHandle) {
            case 'se': {
                nw = clamp(w + dx, min, 1 - x);
                if (normRatio > 0) {
                    nh = nw / normRatio;
                    if (y + nh > 1) {
                        nh = 1 - y;
                        nw = nh * normRatio;
                    }
                } else {
                    nh = clamp(h + dy, min, 1 - y);
                }
                nx = x;
                ny = y;
                break;
            }
            case 'sw': {
                nw = clamp(w - dx, min, x + w);
                if (normRatio > 0) {
                    nh = nw / normRatio;
                    if (y + nh > 1) {
                        nh = 1 - y;
                        nw = nh * normRatio;
                    }
                } else {
                    nh = clamp(h + dy, min, 1 - y);
                }
                nx = x + w - nw;
                ny = y;
                break;
            }
            case 'ne': {
                nw = clamp(w + dx, min, 1 - x);
                if (normRatio > 0) {
                    nh = nw / normRatio;
                    if (y + h - nh < 0) {
                        nh = y + h;
                        nw = nh * normRatio;
                    }
                    ny = y + h - nh;
                } else {
                    nh = clamp(h - dy, min, y + h);
                    ny = y + h - nh;
                }
                nx = x;
                break;
            }
            case 'nw': {
                nw = clamp(w - dx, min, x + w);
                if (normRatio > 0) {
                    nh = nw / normRatio;
                    if (y + h - nh < 0) {
                        nh = y + h;
                        nw = nh * normRatio;
                    }
                    ny = y + h - nh;
                } else {
                    nh = clamp(h - dy, min, y + h);
                    ny = y + h - nh;
                }
                nx = x + w - nw;
                break;
            }
            case 'n': {
                nh = clamp(h - dy, min, y + h);
                if (normRatio > 0) {
                    nw = nh * normRatio;
                    const cx = x + w / 2;
                    nx = clamp(cx - nw / 2, 0, 1 - nw);
                } else {
                    nw = w;
                    nx = x;
                }
                ny = y + h - nh;
                break;
            }
            case 's': {
                nh = clamp(h + dy, min, 1 - y);
                if (normRatio > 0) {
                    nw = nh * normRatio;
                    const cx = x + w / 2;
                    nx = clamp(cx - nw / 2, 0, 1 - nw);
                } else {
                    nw = w;
                    nx = x;
                }
                ny = y;
                break;
            }
            case 'w': {
                nw = clamp(w - dx, min, x + w);
                if (normRatio > 0) {
                    nh = nw / normRatio;
                    const cy = y + h / 2;
                    ny = clamp(cy - nh / 2, 0, 1 - nh);
                } else {
                    nh = h;
                    ny = y;
                }
                nx = x + w - nw;
                break;
            }
            case 'e': {
                nw = clamp(w + dx, min, 1 - x);
                if (normRatio > 0) {
                    nh = nw / normRatio;
                    const cy = y + h / 2;
                    ny = clamp(cy - nh / 2, 0, 1 - nh);
                } else {
                    nh = h;
                    ny = y;
                }
                nx = x;
                break;
            }
        }

        lx = nx;
        ly = ny;
        lw = nw;
        lh = nh;
    }

    function endDrag() {
        isDragging = false;
        dragHandle = null;
        window.removeEventListener('mousemove', onDrag);
        window.removeEventListener('mouseup', endDrag);
        oncrop(lx, ly, lw, lh);
    }

    let cornerHandles = $derived([
        {
            id: 'nw' as Handle,
            x: cpx.left,
            y: cpx.top,
            cursor: 'nw-resize',
        },
        {
            id: 'ne' as Handle,
            x: cpx.left + cpx.width,
            y: cpx.top,
            cursor: 'ne-resize',
        },
        {
            id: 'sw' as Handle,
            x: cpx.left,
            y: cpx.top + cpx.height,
            cursor: 'sw-resize',
        },
        {
            id: 'se' as Handle,
            x: cpx.left + cpx.width,
            y: cpx.top + cpx.height,
            cursor: 'se-resize',
        },
    ]);

    let edgeHandles = $derived([
        {
            id: 'n' as Handle,
            x: cpx.left + cpx.width / 2,
            y: cpx.top,
            cursor: 'n-resize',
            w: 24,
            h: 6,
        },
        {
            id: 's' as Handle,
            x: cpx.left + cpx.width / 2,
            y: cpx.top + cpx.height,
            cursor: 's-resize',
            w: 24,
            h: 6,
        },
        {
            id: 'w' as Handle,
            x: cpx.left,
            y: cpx.top + cpx.height / 2,
            cursor: 'w-resize',
            w: 6,
            h: 24,
        },
        {
            id: 'e' as Handle,
            x: cpx.left + cpx.width,
            y: cpx.top + cpx.height / 2,
            cursor: 'e-resize',
            w: 6,
            h: 24,
        },
    ]);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="absolute inset-0 z-10" style="pointer-events: none;">
    <!-- Crop area with dark mask -->
    <div
        class="absolute border border-white/70"
        style="
            left: {cpx.left}px; top: {cpx.top}px;
            width: {cpx.width}px; height: {cpx.height}px;
            box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
            pointer-events: auto; cursor: move;
        "
        onmousedown={e => startDrag(e, 'move')}
    >
        <!-- Rule of thirds grid -->
        <div class="pointer-events-none absolute inset-0">
            <div
                class="absolute bottom-0 left-1/3 top-0 w-px bg-white/20"
            ></div>
            <div
                class="absolute bottom-0 left-2/3 top-0 w-px bg-white/20"
            ></div>
            <div class="absolute left-0 right-0 top-1/3 h-px bg-white/20"></div>
            <div class="absolute left-0 right-0 top-2/3 h-px bg-white/20"></div>
        </div>

        <!-- Corner brackets -->
        <div
            class="pointer-events-none absolute left-0 top-0 h-4 w-4 border-l-2 border-t-2 border-white"
        ></div>
        <div
            class="pointer-events-none absolute right-0 top-0 h-4 w-4 border-r-2 border-t-2 border-white"
        ></div>
        <div
            class="pointer-events-none absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 border-white"
        ></div>
        <div
            class="pointer-events-none absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 border-white"
        ></div>

        <!-- Dimension label -->
        <div class="pointer-events-none absolute bottom-1 right-1.5">
            <span
                class="bg-black/60 px-1.5 py-0.5 font-mono text-[9px] text-white/70"
            >
                {Math.round(lw * naturalWidth)} x {Math.round(
                    lh * naturalHeight
                )}
            </span>
        </div>
    </div>

    <!-- Corner handles -->
    {#each cornerHandles as c}
        <div
            class="absolute border border-black/40 bg-white"
            style="
                left: {c.x - 5}px; top: {c.y - 5}px;
                width: 10px; height: 10px;
                cursor: {c.cursor}; pointer-events: auto;
            "
            onmousedown={e => startDrag(e, c.id)}
        ></div>
    {/each}

    <!-- Edge handles -->
    {#each edgeHandles as ed}
        <div
            class="absolute border border-black/40 bg-white"
            style="
                left: {ed.x - ed.w / 2}px; top: {ed.y - ed.h / 2}px;
                width: {ed.w}px; height: {ed.h}px;
                cursor: {ed.cursor}; pointer-events: auto;
            "
            onmousedown={e => startDrag(e, ed.id)}
        ></div>
    {/each}
</div>
