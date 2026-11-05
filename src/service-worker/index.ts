import { version } from '$app/env';
import { assets, immutable, prerendered } from '$app/manifest';
import { self } from '$app/service-worker';

const CACHE = `app-shell-${version}`;

/** The manifest paths have no leading slash and the prerendered page is an empty path. The social preview and install dialog images stay out of the shell: only crawlers and installers fetch them. */
const shell = new Set(
	[...immutable, ...assets, ...prerendered].map(({ path }) => `/${path}`).filter((path) => !/^\/(og-image|screenshot)/.test(path))
);

self.addEventListener('install', (event) => {
	event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(shell)));
});

self.addEventListener('activate', (event) => {
	event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))));
});

self.addEventListener('fetch', (event) => {
	const { request } = event;
	const { origin, pathname } = new URL(request.url);

	/** Cross-origin requests (the OpenAI API included) and non-GET requests go straight to the network. */
	if (request.method !== 'GET' || origin !== self.location.origin) return;

	if (request.mode === 'navigate') {
		event.respondWith(fetch(request).catch(async () => (await caches.match('/')) ?? Response.error()));
	} else if (shell.has(pathname)) {
		event.respondWith(caches.match(request).then((cached) => cached ?? fetch(request)));
	}
});
