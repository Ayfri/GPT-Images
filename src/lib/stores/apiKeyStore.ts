import { browser } from '$app/environment';
import { writable } from 'svelte/store';

const API_KEY_STORAGE_KEY = 'openai-api-key';

const defaultValue = browser ? localStorage.getItem(API_KEY_STORAGE_KEY) || '' : '';

// Create a store for the API key
export const apiKey = writable<string>(defaultValue);

// Subscribe to changes and update localStorage
if (browser) {
  apiKey.subscribe(value => {
    if (value) {
      localStorage.setItem(API_KEY_STORAGE_KEY, value);
    } else {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
    }
  });
}