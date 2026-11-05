import { browser } from '$app/env';

const STORAGE_KEY = 'openai-api-key';

class ApiKey {
	#value = $state(browser ? (localStorage.getItem(STORAGE_KEY) ?? '') : '');

	get value() {
		return this.#value;
	}

	set value(key: string) {
		this.#value = key;
		if (key) localStorage.setItem(STORAGE_KEY, key);
		else localStorage.removeItem(STORAGE_KEY);
	}
}

export const apiKey = new ApiKey();
