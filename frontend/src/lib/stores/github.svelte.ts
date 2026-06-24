import type {githubsource} from '../../../wailsjs/go/models';

type ImageInfo = githubsource.ImageInfo;

let url = $state('');
let results = $state<ImageInfo[]>([]);
let isLoading = $state(false);
let error = $state('');

export function getURL(): string {
	return url;
}

export function getResults(): ImageInfo[] {
	return results;
}

export function getIsLoading(): boolean {
	return isLoading;
}

export function getError(): string {
	return error;
}

export function setURL(u: string): void {
	url = u;
}

export function navigateToDir(dirName: string): void {
	const base = url.replace(/\/+$/, '');
	url = `${base}/${dirName}`;
	fetchImages();
}

export function goUp(): void {
	const trimmed = url.replace(/\/+$/, '');
	const lastSlash = trimmed.lastIndexOf('/');
	if (lastSlash > 0) {
		url = trimmed.substring(0, lastSlash);
		fetchImages();
	}
}

export async function fetchImages(): Promise<void> {
	const trimmed = url.trim();
	if (!trimmed) return;

	isLoading = true;
	error = '';
	results = [];

	try {
		const {ListGitHubImages, GetGitHubThumbnail} = await import(
			'../../../wailsjs/go/main/App'
		);
		const result = await ListGitHubImages(trimmed);
		results = result?.items ?? [];

		// Pre-warm disk cache for first 12 images so they load instantly on scroll.
		// Fire-and-forget: each call starts the HTTP download + resize in a Go
		// goroutine; by the time RemoteImage calls GetGitHubThumbnail, the cached
		// thumbnail file exists and returns immediately.
		const files = results.filter(i => i.type === 'file');
		for (const f of files.slice(0, 12)) {
			GetGitHubThumbnail(f.url).catch(() => {});
		}
	} catch (e: any) {
		error = e?.message || 'Failed to fetch images from GitHub';
		results = [];
	} finally {
		isLoading = false;
	}
}
