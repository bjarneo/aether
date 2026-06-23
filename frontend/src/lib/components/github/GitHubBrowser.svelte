<script lang="ts">
	import RemoteImage from './RemoteImage.svelte';
	import {getCardSize, CARD_MIN_WIDTH} from '$lib/stores/cardsize.svelte';
	import CardSizeToggle from '$lib/components/shared/CardSizeToggle.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import LoadingState from '$lib/components/shared/LoadingState.svelte';
	import ViewHeader from '$lib/components/shared/ViewHeader.svelte';
	import ImagePreview from '$lib/components/shared/ImagePreview.svelte';
	import {
		setWallpaperPath,
		addAdditionalImage,
		getAdditionalImages,
	} from '$lib/stores/theme.svelte';
	import {setActiveTab, showToast} from '$lib/stores/ui.svelte';
	import {applyWallpaperOnly} from '$lib/actions/themeActions';
	import {getIsApplying} from '$lib/stores/theme.svelte';
	import {
		getURL,
		getResults,
		getIsLoading,
		getError,
		setURL,
		fetchImages,
	} from '$lib/stores/github.svelte';

	let urlInput = $state(getURL());
	let previewIndex = $state(-1);

	function handleSubmit() {
		setURL(urlInput);
		fetchImages();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') handleSubmit();
	}

	async function handleUse(image: {name: string; url: string}) {
		try {
			const {DownloadWallpaper} = await import(
				'../../../../wailsjs/go/main/App'
			);
			const localPath = await DownloadWallpaper(image.url);
			setWallpaperPath(localPath);
			setActiveTab('editor');
			showToast('Wallpaper selected — click Extract to generate palette');
		} catch {
			showToast('Failed to download wallpaper');
		}
	}

	async function handleAddExtra(event: MouseEvent, image: {name: string; url: string}) {
		event.stopPropagation();
		try {
			showToast('Downloading wallpaper...');
			const {DownloadWallpaper} = await import(
				'../../../../wailsjs/go/main/App'
			);
			const localPath = await DownloadWallpaper(image.url);
			if (getAdditionalImages().includes(localPath)) {
				showToast('Already in additional images');
				return;
			}
			addAdditionalImage(localPath);
			showToast('Added to additional images');
		} catch {
			showToast('Failed to download wallpaper');
		}
	}

	function handlePreview(index: number) {
		previewIndex = index;
	}

	let results = $derived(getResults());
	let isLoading = $derived(getIsLoading());
	let error = $derived(getError());
</script>

<div class="flex h-full flex-col">
	<ViewHeader>
		<span class="text-fg-primary shrink-0 text-[11px] font-medium"
			>GitHub URL</span
		>
		<input
			type="text"
			bind:value={urlInput}
			placeholder="https://github.com/owner/repo"
			class="bg-bg-primary text-fg-primary border-border focus:border-border-focus placeholder:text-fg-dimmed min-w-[300px] flex-1 border px-2 py-0.5 text-[11px] outline-none transition-colors"
			onkeydown={handleKeydown}
		/>
		<button
			class="bg-accent hover:bg-accent-hover text-accent-fg px-3 py-0.5 text-[11px] font-medium transition-colors disabled:opacity-50"
			onclick={handleSubmit}
			disabled={isLoading || !urlInput.trim()}
		>
			{isLoading ? 'Loading...' : 'Fetch'}
		</button>
		<div class="ml-auto flex items-center gap-2">
			<CardSizeToggle />
			{#if results.length > 0}
				<span class="text-fg-dimmed text-[10px]"
					>{results.length} image{results.length === 1 ? '' : 's'}</span
				>
			{/if}
		</div>
	</ViewHeader>

	<div class="flex-1 overflow-y-auto p-3">
		{#if isLoading}
			<LoadingState message="Fetching images from GitHub…" />
		{:else if error}
			<EmptyState title="Failed to load" body={error} />
		{:else if results.length === 0}
			<EmptyState
				title="No images to show"
				body="Enter a GitHub repository URL above and click Fetch to browse wallpapers."
			>
				{#snippet icon()}
					<svg
						class="h-12 w-12"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path
							d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"
						></path>
						<path
							d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"
						></path>
					</svg>
				{/snippet}
			</EmptyState>
		{:else}
			<div
				class="grid gap-3"
				style:grid-template-columns="repeat(auto-fill, minmax({CARD_MIN_WIDTH[getCardSize()]}px, 1fr))"
			>
				{#each results as img, i}
					<div
						class="bg-bg-surface border-border hover:border-border-focus group relative border transition-colors duration-100"
					>
						<button
							class="w-full text-left"
							onclick={() => handleUse(img)}
							title="Download, set as wallpaper, and open in editor"
						>
							<div class="bg-bg-primary aspect-video overflow-hidden">
								<RemoteImage url={img.url} alt={img.name} />
							</div>
						</button>

						<button
							class="absolute left-1.5 top-1.5 z-10 flex h-7 w-7 items-center justify-center opacity-0 transition-all duration-150 hover:!opacity-100 group-hover:opacity-60"
							onclick={e => handleAddExtra(e, img)}
							aria-label="Add to additional images"
						>
							<svg class="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none"
								stroke="currentColor" stroke-width="2" stroke-linecap="round"
								stroke-linejoin="round">
								<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
								<line x1="12" y1="8" x2="12" y2="16"></line>
								<line x1="8" y1="12" x2="16" y2="12"></line>
							</svg>
						</button>

						<div
							class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
						>
							<button
								class="bg-accent hover:bg-accent-hover text-accent-fg pointer-events-auto min-w-[7rem] px-4 py-1.5 text-[11px] font-medium transition-colors"
								onclick={() => handleUse(img)}
								title="Download, set as wallpaper, and open in editor"
								>Use</button
							>
							<div class="flex items-center gap-2 text-[10px] text-white/85">
								<button
									class="pointer-events-auto px-1 transition-colors hover:text-white disabled:opacity-50"
									onclick={e => {
										e.stopPropagation();
										applyWallpaperOnly(img.url);
									}}
									disabled={getIsApplying()}
									title="Apply this wallpaper without changing the current palette"
									>Wallpaper only</button
								>
								<span class="text-white/30" aria-hidden="true">·</span>
								<button
									class="pointer-events-auto px-1 transition-colors hover:text-white"
									onclick={e => {
										e.stopPropagation();
										handlePreview(i);
									}}
									title="Preview wallpaper full-size">Preview</button
								>
							</div>
						</div>

						<div class="text-fg-dimmed flex items-center px-2 py-1 text-[10px]">
							<span class="truncate">{img.name}</span>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<ImagePreview
	src={previewIndex >= 0 ? results[previewIndex]?.url : ''}
	alt={previewIndex >= 0 ? results[previewIndex]?.name : ''}
	open={previewIndex >= 0}
	onclose={() => (previewIndex = -1)}
	hasPrev={previewIndex > 0}
	hasNext={previewIndex < results.length - 1}
	onprev={() => previewIndex--}
	onnext={() => previewIndex++}
/>
