const ZOOM_STEP = 0.1;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.0;
const ZOOM_DEFAULT = 1.0;
const ZOOM_KEY = 'aether-zoom';

export function getZoom(): number {
    return parseFloat(localStorage.getItem(ZOOM_KEY) || '1');
}

export function setZoom(level: number): void {
    const clamped = Math.min(
        ZOOM_MAX,
        Math.max(ZOOM_MIN, Math.round(level * 100) / 100)
    );
    document.documentElement.style.zoom = String(clamped);
    localStorage.setItem(ZOOM_KEY, String(clamped));
}

export function zoomIn(): void {
    setZoom(getZoom() + ZOOM_STEP);
}

export function zoomOut(): void {
    setZoom(getZoom() - ZOOM_STEP);
}

export function resetZoom(): void {
    setZoom(ZOOM_DEFAULT);
}
