/** Model-written SVG is stripped of scripts and script URLs before storage: blob: URLs share the app origin, where the API key lives. */
export function sanitizeSvgBase64(b64: string): string {
	const doc = new DOMParser().parseFromString(new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))), 'image/svg+xml');
	if (doc.querySelector('parsererror')) throw new Error('The generated SVG is invalid.');

	/** Animating an href attribute (`<set attributeName="href" to="javascript:...">`) bypasses the attribute check below. */
	for (const el of doc.querySelectorAll('script, foreignObject, [attributeName$="href" i]')) el.remove();
	for (const el of doc.querySelectorAll('*')) {
		for (const { name, value } of [...el.attributes]) {
			if (name.startsWith('on') || (/^(xlink:)?href$/i.test(name) && /^(javascript:|data:(?!image\/))/i.test(value.trim()))) el.removeAttribute(name);
		}
	}

	return btoa(Array.from(new TextEncoder().encode(new XMLSerializer().serializeToString(doc)), (byte) => String.fromCharCode(byte)).join(''));
}
