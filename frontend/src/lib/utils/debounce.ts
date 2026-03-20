export function debounce<T extends (...args: any[]) => any>(
    fn: T,
    ms: number
): T {
    let timer: ReturnType<typeof setTimeout>;
    return ((...args: any[]) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    }) as T;
}
