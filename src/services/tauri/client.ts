import { invoke } from '@tauri-apps/api/core';

export { invoke };

export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

export const withTimeout = <T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string,
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new Error(
          `${operationName} timed out after ${Math.round(timeoutMs / 1000)} seconds. Verify host address, port, and firewall rules.`,
        ),
      );
    }, timeoutMs);
  });

  return Promise.race([
    promise.then(
      (res) => {
        if (timer) clearTimeout(timer);
        return res;
      },
      (err) => {
        if (timer) clearTimeout(timer);
        throw err;
      },
    ),
    timeoutPromise,
  ]);
};
