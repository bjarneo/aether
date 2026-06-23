<script lang="ts">
	import {observeIntersection} from '$lib/utils/intersection';

	let {url, alt = ''}: {url: string; alt?: string} = $props();

	let el = $state<HTMLDivElement | null>(null);
	let inView = $state(false);

	$effect(() => {
		if (!el) return;
		return observeIntersection(
			el,
			entry => {
				if (entry.isIntersecting) inView = true;
			},
			{rootMargin: '400px 0px'}
		);
	});
</script>

<div bind:this={el} class="h-full w-full">
	{#if inView}
		<img
			src={url}
			{alt}
			class="h-full w-full object-cover"
			loading="lazy"
		/>
	{/if}
</div>
