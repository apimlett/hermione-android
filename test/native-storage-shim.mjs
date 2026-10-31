// Test-only Android platform/Keystore seam. The in-memory localStorage fixture is never shipped.
export const Platform = { OS: 'android' };
export const getItemAsync = async (key) => globalThis.localStorage?.getItem(key) ?? null;
export const setItemAsync = async (key, value) => { globalThis.localStorage?.setItem(key, value); };
export const deleteItemAsync = async (key) => { globalThis.localStorage?.removeItem(key); };
