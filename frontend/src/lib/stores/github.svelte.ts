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

export async function fetchImages(): Promise<void> {
	const trimmed = url.trim();
	if (!trimmed) return;

	isLoading = true;
	error = '';
	results = [];

	try {
		const {ListGitHubImages} = await import(
			'../../../wailsjs/go/main/App'
		);
		const data = await ListGitHubImages(trimmed);
		results = Array.isArray(data) ? data : [];
	} catch (e: any) {
		error = e?.message || 'Failed to fetch images from GitHub';
		results = [];
	} finally {
		isLoading = false;
	}
}
