export function observeIntersection(
    element: Element,
    callback: (entry: IntersectionObserverEntry) => void,
    options?: IntersectionObserverInit
): () => void {
    const observer = new IntersectionObserver(entries => {
        for (const entry of entries) callback(entry);
    }, options);
    observer.observe(element);
    return () => observer.disconnect();
}
