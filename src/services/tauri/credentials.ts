import { invoke } from './client';

export async function storeCredential(connectionId: string, password: string): Promise<void> {
  try {
    return await invoke<void>('store_credential', { connectionId, password });
  } catch (err) {
    console.warn('Failed to store credential in OS keychain:', err);
  }
}

export async function getCredential(connectionId: string): Promise<string | null> {
  try {
    return await invoke<string | null>('get_credential', { connectionId });
  } catch (err) {
    console.warn('Failed to retrieve credential from OS keychain:', err);
    return null;
  }
}

export async function deleteCredential(connectionId: string): Promise<void> {
  try {
    return await invoke<void>('delete_credential', { connectionId });
  } catch (err) {
    console.warn('Failed to delete credential from OS keychain:', err);
  }
}
