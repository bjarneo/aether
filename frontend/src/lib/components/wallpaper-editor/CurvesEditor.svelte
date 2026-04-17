<script lang="ts">
    import {buildCurveLUT} from '$lib/utils/canvas-filters';

    const W = 256;
    const H = 192;
    const PAD = 0;

    let {
        points = $bindable<[number, number][]>([]),
        histogram = [] as number[],
        onchange = () => {},
    }: {
        points: [number, number][];
        histogram: number[];
        onchange: () => void;
    } = $props();

    let canvasEl = $state<HTMLCanvasElement | null>(null);
    let dragging = $state<number | null>(null);

    // Redraw whenever points or histogram change. JSON.stringify ensures
    // coordinate mutations (not just length changes) trigger a redraw.
    $effect(() => {
        const _ = JSON.stringify(points);
        const __ = histogram.length;
        draw();
    });

    function toCanvas(px: number, py: number): [number, number] {
        return [PAD + px * W, PAD + (1 - py) * H];
    }

    function fromCanvas(cx: number, cy: number): [number, number] {
        return [
            Math.max(0, Math.min(1, (cx - PAD) / W)),
            Math.max(0, Math.min(1, 1 - (cy - PAD) / H)),
        ];
    }

    function draw() {
        if (!canvasEl) return;
        const ctx = canvasEl.getContext('2d');
        if (!ctx) return;
        const cw = canvasEl.width;
        const ch = canvasEl.height;
        ctx.clearRect(0, 0, cw, ch);

        // Histogram bars
        if (histogram.length === 256) {
            const max = Math.max(...histogram);
            if (max > 0) {
                ctx.fillStyle = 'rgba(255,255,255,0.08)';
                for (let i = 0; i < 256; i++) {
                    const barH = (histogram[i] / max) * H;
                    ctx.fillRect(PAD + i, PAD + H - barH, 1, barH);
                }
            }
        }

        // Grid lines
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        for (let i = 1; i < 4; i++) {
            const x = PAD + (W * i) / 4;
            const y = PAD + (H * i) / 4;
            ctx.beginPath();
            ctx.moveTo(x, PAD);
            ctx.lineTo(x, PAD + H);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(PAD, y);
            ctx.lineTo(PAD + W, y);
            ctx.stroke();
        }

        // Diagonal reference (identity)
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(...toCanvas(0, 0));
        ctx.lineTo(...toCanvas(1, 1));
        ctx.stroke();
        ctx.setLineDash([]);

        // Curve from LUT
        const lut = buildCurveLUT(points);
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < 256; i++) {
            const x = PAD + i;
            const val = lut ? lut[i] / 255 : i / 255;
            const y = PAD + (1 - val) * H;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Control points
        const allPts: {x: number; y: number; fixed: boolean}[] = [
            {x: 0, y: 0, fixed: true},
            ...points.map(([x, y]) => ({x, y, fixed: false})),
            {x: 1, y: 1, fixed: true},
        ];

        for (const pt of allPts) {
            const [cx, cy] = toCanvas(pt.x, pt.y);
            ctx.beginPath();
            ctx.arc(cx, cy, pt.fixed ? 3 : 5, 0, Math.PI * 2);
            ctx.fillStyle = pt.fixed
                ? 'rgba(255,255,255,0.3)'
                : 'rgba(255,255,255,0.9)';
            ctx.fill();
            if (!pt.fixed) {
                ctx.strokeStyle = 'rgba(0,0,0,0.5)';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }
    }

    function getMousePos(e: MouseEvent): [number, number] {
        const rect = canvasEl!.getBoundingClientRect();
        const scaleX = canvasEl!.width / rect.width;
        const scaleY = canvasEl!.height / rect.height;
        return [
            (e.clientX - rect.left) * scaleX,
            (e.clientY - rect.top) * scaleY,
        ];
    }

    function findNearestPoint(cx: number, cy: number): number | null {
        let best = -1;
        let bestDist = 15; // max grab distance in canvas pixels
        for (let i = 0; i < points.length; i++) {
            const [px, py] = toCanvas(points[i][0], points[i][1]);
            const dist = Math.sqrt((cx - px) ** 2 + (cy - py) ** 2);
            if (dist < bestDist) {
                bestDist = dist;
                best = i;
            }
        }
        return best >= 0 ? best : null;
    }

    function handleMouseDown(e: MouseEvent) {
        if (!canvasEl) return;
        const [cx, cy] = getMousePos(e);

        // Right-click or ctrl+click removes nearest point
        if (e.button === 2 || (e.button === 0 && e.ctrlKey)) {
            e.preventDefault();
            const idx = findNearestPoint(cx, cy);
            if (idx !== null) {
                points = points.filter((_, i) => i !== idx);
                onchange();
            }
            return;
        }

        // Left-click: try to grab existing point, else add new
        const idx = findNearestPoint(cx, cy);
        if (idx !== null) {
            dragging = idx;
        } else {
            const [x, y] = fromCanvas(cx, cy);
            points = [...points, [x, y]];
            dragging = points.length - 1;
            onchange();
        }
    }

    function handleMouseMove(e: MouseEvent) {
        if (dragging === null || !canvasEl) return;
        const [cx, cy] = getMousePos(e);
        const [x, y] = fromCanvas(cx, cy);
        // Clamp x to avoid overlapping endpoints
        const clampedX = Math.max(0.01, Math.min(0.99, x));
        points = points.map((p, i) =>
            i === dragging ? ([clampedX, y] as [number, number]) : p
        );
        onchange();
    }

    function handleMouseUp() {
        dragging = null;
    }
</script>

<div class="space-y-1.5">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <canvas
        bind:this={canvasEl}
        width={W}
        height={H}
        class="border-border w-full cursor-crosshair border"
        style="height: {H}px; image-rendering: auto;"
        onmousedown={handleMouseDown}
        onmousemove={handleMouseMove}
        onmouseup={handleMouseUp}
        onmouseleave={handleMouseUp}
        oncontextmenu={e => e.preventDefault()}
    ></canvas>
    <div class="flex items-center justify-between">
        <span class="text-fg-dimmed text-[9px]">
            Click to add · drag to adjust · ctrl+click to remove
        </span>
        {#if points.length > 0}
            <button
                type="button"
                class="text-fg-dimmed hover:text-fg-secondary text-[10px] transition-colors"
                onclick={() => {
                    points = [];
                    onchange();
                }}>Reset</button
            >
        {/if}
    </div>
</div>
