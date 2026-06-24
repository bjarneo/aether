<script lang="ts">
	import GitHubCard from './GitHubCard.svelte';
	import {getCardSize, CARD_MIN_WIDTH} from '$lib/stores/cardsize.svelte';
	import CardSizeToggle from '$lib/components/shared/CardSizeToggle.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import LoadingState from '$lib/components/shared/LoadingState.svelte';
	import ViewHeader from '$lib/components/shared/ViewHeader.svelte';
	import ImagePreview from '$lib/components/shared/ImagePreview.svelte';
	import type {githubsource} from '../../../../wailsjs/go/models';
	import {showToast} from '$lib/stores/ui.svelte';
	import {
		getURL,
		getResults,
		getIsLoading,
		getError,
		setURL,
		fetchImages,
		navigateToDir as storeNavigateToDir,
		goUp as storeGoUp,
	} from '$lib/stores/github.svelte';

	type ImageInfo = githubsource.ImageInfo;

	const SAVED_REPOS_KEY = 'aether-saved-repos';

	type SavedRepo = {name: string; url: string};

	function loadSavedRepos(): SavedRepo[] {
		try {
			return JSON.parse(localStorage.getItem(SAVED_REPOS_KEY) || '[]');
		} catch {
			return [];
		}
	}

	function saveRepos(repos: SavedRepo[]) {
		localStorage.setItem(SAVED_REPOS_KEY, JSON.stringify(repos));
	}

	let urlInput = $state(getURL());
	let previewIndex = $state(-1);
	let savedRepos = $state<SavedRepo[]>(loadSavedRepos());
	let savedReposOpen = $state(false);
	let savedReposRef = $state<HTMLDivElement | null>(null);

	let nameFilter = $state('');

	let results = $derived(getResults());
	let isLoading = $derived(getIsLoading());
	let error = $derived(getError());
	let filteredResults = $derived(
		nameFilter
			? results.filter(i =>
					i.name.toLowerCase().includes(nameFilter.toLowerCase())
				)
			: results
	);
	let fileResults = $derived(filteredResults.filter(i => i.type === 'file'));
	let dirResults = $derived(filteredResults.filter(i => i.type === 'dir'));

	let canGoUp = $derived.by(() => {
		const u = getURL();
		try {
			const parsed = new URL(u);
			const host = parsed.hostname.toLowerCase();
			const segs = parsed.pathname.replace(/\/+$/, '').split('/').filter(Boolean);

			if (host === 'github.com') {
				if (segs.length <= 2) return false;
				if (segs.length === 4 && segs[2] === 'tree') return false;
				return true;
			}

			if (host.endsWith('.github.io')) {
				return segs.length > 0;
			}

			if (host === 'raw.githubusercontent.com') {
				return segs.length > 3;
			}

			return false;
		} catch {
			return false;
		}
	});

	let currentIsSaved = $derived(savedRepos.some(r => r.url === getURL()));

	// Close saved-repos dropdown on outside click
	$effect(() => {
		if (!savedReposOpen || !savedReposRef) return;
		function onPointerDown(e: PointerEvent) {
			if (savedReposRef && !savedReposRef.contains(e.target as Node)) {
				savedReposOpen = false;
			}
		}
		window.addEventListener('pointerdown', onPointerDown);
		return () => window.removeEventListener('pointerdown', onPointerDown);
	});

	function handleSubmit() {
		setURL(urlInput);
		fetchImages();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') handleSubmit();
	}

	function handleNavigate(dirName: string) {
		storeNavigateToDir(dirName);
		urlInput = getURL();
	}

	function handleGoUp() {
		storeGoUp();
		urlInput = getURL();
	}

	function handlePreview(img: ImageInfo) {
		previewIndex = fileResults.findIndex(f => f.path === img.path);
	}

	function toggleSaveRepo() {
		const current = getURL();
		if (!current.trim()) return;
		let repos = loadSavedRepos();
		const idx = repos.findIndex(r => r.url === current);
		if (idx >= 0) {
			repos.splice(idx, 1);
			showToast('Removed from saved repos');
		} else {
			let name = current.replace(/\/+$/, '');
			try {
				const parsed = new URL(current);
				const segs = parsed.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
				if (segs.length >= 2) {
					name = `${segs[0]}/${segs[1]}`;
				} else {
					name = segs[segs.length - 1] || current;
				}
			} catch {}
			repos.push({name, url: current});
			showToast('Repo saved');
		}
		saveRepos(repos);
		savedRepos = repos;
	}

	function loadSavedRepo(url: string) {
		setURL(url);
		urlInput = url;
		savedReposOpen = false;
		fetchImages();
	}

	function removeSavedRepo(event: MouseEvent, url: string) {
		event.stopPropagation();
		let repos = loadSavedRepos();
		repos = repos.filter(r => r.url !== url);
		saveRepos(repos);
		savedRepos = repos;
	}
</script>

<div class="flex h-full flex-col">
	<ViewHeader>
		<span class="text-fg-primary shrink-0 text-[11px] font-medium"
			>GitHub URL</span
		>
		<button
			class="border-border text-fg-dimmed hover:text-fg-primary flex h-[22px] w-[22px] items-center justify-center border text-[11px] transition-colors disabled:opacity-30"
			onclick={handleGoUp}
			disabled={!canGoUp}
			title="Go to parent directory"
		>&#8593;</button>
		<!-- Saved repos dropdown -->
		<div bind:this={savedReposRef} class="relative">
			<button
				class="border-border flex h-[22px] w-[22px] items-center justify-center border text-[11px] transition-colors {currentIsSaved ? 'text-yellow-500' : 'text-fg-dimmed hover:text-fg-primary'}"
				onclick={() => savedReposOpen = !savedReposOpen}
				title="Saved repos"
			>
				<svg class="h-3 w-3" viewBox="0 0 24 24" fill={currentIsSaved ? 'currentColor' : 'none'}
					stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
				</svg>
			</button>
			{#if savedReposOpen}
				<div
					class="bg-bg-secondary border-border absolute left-0 z-50 mt-0.5 min-w-[200px] border shadow-lg"
				>
					<div class="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
						<span class="text-fg-dimmed text-[10px] font-medium tracking-wide">SAVED REPOS</span>
						<button
							class="text-fg-dimmed hover:text-fg-primary text-[10px] transition-colors"
							onclick={toggleSaveRepo}
							title={currentIsSaved ? 'Remove current from saved' : 'Save current repo'}
						>
							{currentIsSaved ? 'Remove' : '+ Save current'}
						</button>
					</div>
					{#if savedRepos.length === 0}
						<div class="text-fg-dimmed px-3 py-3 text-[10px]">No saved repos yet</div>
					{:else}
						{#each savedRepos as repo}
							<div
								class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] transition-colors hover:bg-white/5"
								role="button"
								tabindex="0"
								onclick={() => loadSavedRepo(repo.url)}
								onkeydown={e => { if (e.key === 'Enter') loadSavedRepo(repo.url); }}
							>
								<svg class="h-3 w-3 shrink-0 text-fg-dimmed" viewBox="0 0 24 24"
									fill="none" stroke="currentColor" stroke-width="2"
									stroke-linecap="round" stroke-linejoin="round">
									<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
								</svg>
								<span class="truncate text-fg-primary">{repo.name}</span>
								<button
									class="ml-auto shrink-0 px-1 text-[10px] text-fg-dimmed hover:text-red-400 transition-colors"
									onclick={e => removeSavedRepo(e, repo.url)}
									title="Remove"
								>×</button>
							</div>
						{/each}
					{/if}
				</div>
			{/if}
		</div>
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
		{#if results.length > 0}
			<input
				type="text"
				bind:value={nameFilter}
				placeholder="Filter by name…"
				class="bg-bg-primary text-fg-primary border-border focus:border-border-focus placeholder:text-fg-dimmed min-w-[160px] flex-1 border px-2 py-0.5 text-[11px] outline-none transition-colors"
			/>
		{/if}
		<div class="ml-auto flex items-center gap-2">
			<CardSizeToggle />
			{#if results.length > 0}
				<span class="text-fg-dimmed text-[10px]"
					>{fileResults.length} / {results.length}{dirResults.length > 0
						? `, ${dirResults.length} dir${dirResults.length === 1 ? '' : 's'}`
						: ''}</span
				>
			{/if}
		</div>
	</ViewHeader>

	<div class="flex-1 overflow-y-auto p-3">
		{#if isLoading}
			<LoadingState message="Fetching from GitHub…" />
		{:else if error}
			<EmptyState title="Failed to load" body={error} />
		{:else if filteredResults.length === 0 && results.length === 0}
			<EmptyState
				title="Nothing to show"
				body="Enter a GitHub repository URL above and click Fetch to browse wallpapers and directories."
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
		{:else if filteredResults.length === 0 && results.length > 0}
			<EmptyState
				title="No images match filter"
				body="Try a different name or clear the filter."
				actionLabel="Clear filter"
				onaction={() => (nameFilter = '')}
			/>
		{:else}
			<div
				class="grid gap-3"
				style:grid-template-columns="repeat(auto-fill, minmax({CARD_MIN_WIDTH[getCardSize()]}px, 1fr))"
			>
				{#each filteredResults as item, i (item.path)}
					{#if item.type === 'dir'}
						<div
							class="bg-bg-surface border-border hover:border-border-focus group relative cursor-pointer border transition-colors duration-100"
							onclick={() => handleNavigate(item.name)}
							role="button"
							tabindex="0"
							onkeydown={e => { if (e.key === 'Enter') handleNavigate(item.name); }}
						>
							<div class="bg-bg-primary flex aspect-video items-center justify-center">
								<svg class="h-10 w-10 text-fg-dimmed" viewBox="0 0 24 24"
									fill="none" stroke="currentColor" stroke-width="1.5"
									stroke-linecap="round" stroke-linejoin="round">
									<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
								</svg>
							</div>
							<div class="text-fg-dimmed flex items-center px-2 py-1 text-[10px]">
								<span class="truncate">{item.name}</span>
							</div>
						</div>
					{:else}
						<GitHubCard image={item} onpreview={() => handlePreview(item)} />
					{/if}
				{/each}
			</div>
		{/if}
	</div>
</div>

<ImagePreview
	src={previewIndex >= 0 ? fileResults[previewIndex]?.url : ''}
	alt={previewIndex >= 0 ? fileResults[previewIndex]?.name : ''}
	open={previewIndex >= 0}
	onclose={() => (previewIndex = -1)}
	hasPrev={previewIndex > 0}
	hasNext={previewIndex < fileResults.length - 1}
	onprev={() => previewIndex--}
	onnext={() => previewIndex++}
/>
