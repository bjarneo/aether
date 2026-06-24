<script lang="ts">
	import {
		setWallpaperPath,
		addAdditionalImage,
		getAdditionalImages,
	} from '$lib/stores/theme.svelte';
	import {setActiveTab, showToast} from '$lib/stores/ui.svelte';
	import {applyWallpaperOnly} from '$lib/actions/themeActions';
	import {getIsApplying} from '$lib/stores/theme.svelte';
	import {observeIntersection} from '$lib/utils/intersection';
	import type {githubsource} from '../../../../wailsjs/go/models';

	type ImageInfo = githubsource.ImageInfo;

	let {
		image,
		onpreview,
	}: {
		image: ImageInfo;
		onpreview: () => void;
	} = $props();

	let isDownloading = $state(false);
	let isFavorited = $state(false);
	let thumbSrc = $state('');
	let thumbDims = $state('');
	let cardEl = $state<HTMLDivElement | null>(null);
	let inView = $state(false);
	let favoriteChecked = false;
	let loaded = false;

	$effect(() => {
		if (!cardEl) return;
		return observeIntersection(
			cardEl,
			entry => {
				inView = entry.isIntersecting;
				if (inView && !favoriteChecked) {
					favoriteChecked = true;
					checkFavorite();
					loadThumb();
				}
			},
			{rootMargin: '600px 0px'}
		);
	});

	async function checkFavorite() {
		try {
			const {IsFavorite} = await import(
				'../../../../wailsjs/go/main/App'
			);
			isFavorited = await IsFavorite(image.url);
		} catch {}
	}

	async function loadThumb() {
		if (loaded) return;
		loaded = true;
		try {
			const {GetGitHubThumbnail} = await import(
				'../../../../wailsjs/go/main/App'
			);
			const result = await GetGitHubThumbnail(image.url);
			thumbSrc = result.dataURL;
			if (result.width && result.height) {
				thumbDims = `${result.width}×${result.height}`;
			}
		} catch {}
	}

	async function handleUse() {
		isDownloading = true;
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
		} finally {
			isDownloading = false;
		}
	}

	async function handleFavorite(event: MouseEvent) {
		event.stopPropagation();
		try {
			const {ToggleFavorite} = await import(
				'../../../../wailsjs/go/main/App'
			);
			isFavorited = await ToggleFavorite(image.url, '', {name: image.name});
		} catch {}
	}

	async function handleAddExtra(event: MouseEvent) {
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

	function formatSize(bytes: number): string {
		if (!bytes) return '';
		if (bytes < 1024) return bytes + ' B';
		if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
		return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
	}
</script>

<div
	bind:this={cardEl}
	class="bg-bg-surface border-border group relative overflow-hidden border"
>
	<div class="bg-bg-primary aspect-video overflow-hidden">
		{#if inView && thumbSrc}
			<img
				src={thumbSrc}
				alt={image.name}
				class="h-full w-full object-cover"
				loading="lazy"
				decoding="async"
			/>
		{:else if inView}
			<div class="h-full w-full animate-pulse bg-white/5"></div>
		{/if}
	</div>

	<!-- Add to additional images -->
	<button
		class="absolute left-1.5 top-1.5 z-10 flex h-7 w-7 items-center justify-center opacity-0 transition-all duration-150 hover:!opacity-100 group-hover:opacity-60"
		onclick={handleAddExtra}
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

	<!-- Favorite heart -->
	<button
		class="absolute right-1.5 top-1.5 z-10 flex h-7 w-7 items-center justify-center transition-all duration-150
		{isFavorited
			? 'opacity-100'
			: 'opacity-0 hover:!opacity-100 group-hover:opacity-60'}"
		onclick={handleFavorite}
		aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
	>
		<svg class="h-4 w-4 {isFavorited ? 'text-destructive' : 'text-white'}"
			viewBox="0 0 24 24"
			fill={isFavorited ? 'currentColor' : 'none'}
			stroke="currentColor"
			stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
		>
			<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
		</svg>
	</button>

	<!-- Info bar -->
	<div
		class="text-fg-dimmed flex items-center justify-between px-2 py-1.5 text-[10px]"
		title={image.name}
	>
		<span>{thumbDims}</span>
		<span>{formatSize(image.size)}</span>
	</div>

	<!-- Hover overlay -->
	<div
		class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
	>
		<button
			class="bg-accent hover:bg-accent-hover text-accent-fg pointer-events-auto min-w-[7rem] px-4 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-50"
			onclick={handleUse}
			disabled={isDownloading}
			title="Download, set as wallpaper, and open in editor"
		>
			{isDownloading ? 'Loading…' : 'Use'}
		</button>
		<div class="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-2 text-[10px] text-white/85">
			<button
				class="pointer-events-auto px-1 transition-colors hover:text-white disabled:opacity-50"
				onclick={() => applyWallpaperOnly(image.url)}
				disabled={isDownloading || getIsApplying()}
				title="Apply this wallpaper without changing the current palette"
				>Wallpaper only</button
			>
			<span class="text-white/30" aria-hidden="true">·</span>
			<button
				class="pointer-events-auto px-1 transition-colors hover:text-white"
				onclick={onpreview}
				title="Preview wallpaper full-size">Preview</button
			>
		</div>
	</div>
</div>
