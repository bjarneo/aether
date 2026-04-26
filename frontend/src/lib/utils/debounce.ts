export function debounce<TArgs extends unknown[]>(
    fn: (...args: TArgs) => void,
    ms: number
): (...args: TArgs) => void {
    let timer: ReturnType<typeof setTimeout>;
    return (...args: TArgs) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
}
