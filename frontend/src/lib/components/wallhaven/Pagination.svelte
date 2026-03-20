<script lang="ts">
    let {
        currentPage,
        totalPages,
        onPageChange,
    }: {
        currentPage: number;
        totalPages: number;
        onPageChange: (page: number) => void;
    } = $props();
</script>

<div
    class="bg-bg-secondary border-border flex items-center justify-center gap-2 border-t p-3"
>
    <button
        class="text-fg-secondary hover:text-fg-primary px-2 py-1 text-xs disabled:opacity-30"
        onclick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}>Prev</button
    >

    <span class="text-fg-dimmed text-xs">
        {currentPage} / {totalPages}
    </span>

    <button
        class="text-fg-secondary hover:text-fg-primary px-2 py-1 text-xs disabled:opacity-30"
        onclick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}>Next</button
    >
</div>
