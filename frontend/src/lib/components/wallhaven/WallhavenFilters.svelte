<script lang="ts">
    import {
        getQuery,
        setQuery,
        getCategories,
        toggleCategory,
        getPurity,
        togglePurity,
        getSorting,
        setSorting,
        getOrder,
        setOrder,
        getAtleast,
        setAtleast,
        getColorFilter,
        setColorFilter,
        getApiKey,
        setApiKey,
        getTotalResults,
        search,
    } from '$lib/stores/wallhaven.svelte';

    let showAdvanced = $state(false);

    function handleSubmit(e: Event) {
        e.preventDefault();
        search();
    }

    const categoryLabels = ['General', 'Anime', 'People'];
    const purityLabels = ['SFW', 'Sketchy', 'NSFW'];
    const colorPresets = [
        {hex: '660000', label: 'Red'},
        {hex: 'cc6633', label: 'Orange'},
        {hex: 'ffcc00', label: 'Yellow'},
        {hex: '006600', label: 'Green'},
        {hex: '336699', label: 'Blue'},
        {hex: '660066', label: 'Purple'},
        {hex: '000000', label: 'Black'},
        {hex: 'cccccc', label: 'Gray'},
        {hex: 'ffffff', label: 'White'},
    ];
</script>

<form class="bg-bg-secondary border-border border-b" onsubmit={handleSubmit}>
    <!-- Row 1: Search + Sort + Search button -->
    <div class="flex gap-2 p-3 pb-0">
        <input
            type="text"
            class="bg-bg-surface border-border text-fg-primary focus:border-border-focus min-w-[160px] flex-1 border px-2 py-1.5 text-[12px] outline-none"
            placeholder="Search wallpapers..."
            value={getQuery()}
            oninput={e => setQuery(e.currentTarget.value)}
        />

        <select
            class="px-2 py-1.5 text-[12px] outline-none"
            value={getSorting()}
            onchange={e => setSorting(e.currentTarget.value)}
        >
            <option value="date_added">Latest</option>
            <option value="relevance">Relevance</option>
            <option value="random">Random</option>
            <option value="views">Views</option>
            <option value="favorites">Favorites</option>
            <option value="toplist">Top List</option>
        </select>

        <select
            class="px-2 py-1.5 text-[12px] outline-none"
            value={getOrder()}
            onchange={e => setOrder(e.currentTarget.value)}
        >
            <option value="desc">Desc</option>
            <option value="asc">Asc</option>
        </select>

        <button
            type="submit"
            class="bg-accent hover:bg-accent-hover px-3 py-1.5 text-[12px] font-medium text-[#111116] transition-colors"
            >Search</button
        >
    </div>

    <!-- Row 2: Categories + Purity + Resolution + Filters toggle -->
    <div class="flex items-center gap-3 px-3 py-2">
        <!-- Categories -->
        <div class="flex items-center gap-1">
            <span class="text-fg-dimmed mr-1 text-[10px]">Cat:</span>
            {#each categoryLabels as label, i}
                <button
                    type="button"
                    class="border px-1.5 py-0.5 text-[10px] transition-colors
            {getCategories()[i] === '1'
                        ? 'text-accent border-accent bg-accent-muted'
                        : 'text-fg-dimmed border-border hover:text-fg-secondary'}"
                    onclick={() => {
                        toggleCategory(i);
                    }}>{label}</button
                >
            {/each}
        </div>

        <!-- Purity -->
        <div class="flex items-center gap-1">
            <span class="text-fg-dimmed mr-1 text-[10px]">Purity:</span>
            {#each purityLabels as label, i}
                <button
                    type="button"
                    class="border px-1.5 py-0.5 text-[10px] transition-colors
            {i === 2 && !getApiKey()
                        ? 'text-fg-dimmed/30 border-border cursor-not-allowed'
                        : getPurity()[i] === '1'
                          ? i === 0
                              ? 'text-success border-success bg-success/10'
                              : i === 1
                                ? 'text-warning border-warning bg-warning/10'
                                : 'text-destructive border-destructive bg-destructive/10'
                          : 'text-fg-dimmed border-border hover:text-fg-secondary'}"
                    onclick={() => togglePurity(i)}
                    title={i === 2 && !getApiKey()
                        ? 'NSFW requires API key'
                        : ''}>{label}</button
                >
            {/each}
        </div>

        <!-- Resolution -->
        <select
            class="px-1.5 py-0.5 text-[10px] outline-none"
            value={getAtleast()}
            onchange={e => setAtleast(e.currentTarget.value)}
        >
            <option value="">Any Res</option>
            <option value="1920x1080">1920x1080+</option>
            <option value="2560x1440">2560x1440+</option>
            <option value="3840x2160">3840x2160+</option>
        </select>

        <button
            type="button"
            class="text-fg-dimmed hover:text-fg-secondary ml-auto text-[10px] transition-colors"
            onclick={() => (showAdvanced = !showAdvanced)}
            >{showAdvanced ? 'Less' : 'More'}</button
        >

        {#if getTotalResults() > 0}
            <span class="text-fg-dimmed text-[10px]"
                >{getTotalResults().toLocaleString()} results</span
            >
        {/if}
    </div>

    <!-- Advanced: Color filter + API key -->
    {#if showAdvanced}
        <div class="border-border space-y-2 border-t px-3 pb-3 pt-2">
            <!-- Color filter -->
            <div>
                <span class="text-fg-dimmed mb-1 block text-[10px]"
                    >Color Filter</span
                >
                <div class="flex items-center gap-1">
                    {#each colorPresets as cp}
                        <button
                            type="button"
                            class="h-5 w-5 border transition-all
                {getColorFilter() === cp.hex
                                ? 'border-fg-primary scale-110'
                                : 'border-border hover:border-fg-dimmed'}"
                            style:background-color="#{cp.hex}"
                            onclick={() =>
                                setColorFilter(
                                    getColorFilter() === cp.hex ? '' : cp.hex
                                )}
                            title={cp.label}
                        ></button>
                    {/each}
                    {#if getColorFilter()}
                        <button
                            type="button"
                            class="text-fg-dimmed hover:text-fg-secondary ml-1 text-[10px]"
                            onclick={() => setColorFilter('')}>Clear</button
                        >
                    {/if}
                </div>
            </div>

            <!-- API Key -->
            <div>
                <span class="text-fg-dimmed mb-1 block text-[10px]"
                    >API Key <span class="text-fg-dimmed/50"
                        >(for NSFW + more results)</span
                    ></span
                >
                <input
                    type="password"
                    class="bg-bg-surface border-border text-fg-primary focus:border-border-focus w-full border px-2 py-1 text-[11px] outline-none"
                    placeholder="wallhaven API key..."
                    value={getApiKey()}
                    oninput={e => setApiKey(e.currentTarget.value)}
                />
            </div>
        </div>
    {/if}
</form>
