<script lang="ts">
	import {observeIntersection} from '$lib/utils/intersection';

	let {url, alt = ''}: {url: string; alt?: string} = $props();

	let el = $state<HTMLDivElement | null>(null);
	let inView = $state(false);
	let thumbSrc = $state('');

	function loadThumb() {
		if (thumbSrc) return;
		(async () => {
			try {
				const {GetGitHubThumbnail} = await import(
					'../../../../wailsjs/go/main/App'
				);
				thumbSrc = await GetGitHubThumbnail(url);
			} catch {}
		})();
	}

	$effect(() => {
		if (!el) return;
		return observeIntersection(
			el,
			entry => {
				if (entry.isIntersecting) {
					inView = true;
					loadThumb();
				}
			},
			{rootMargin: '400px 0px'}
		);
	});
</script>

<div bind:this={el} class="h-full w-full">
	{#if inView && thumbSrc}
		<img
			src={thumbSrc}
			{alt}
			class="h-full w-full object-cover"
			loading="lazy"
			decoding="async"
		/>
	{/if}
</div>
