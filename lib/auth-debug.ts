const isServer = typeof window === 'undefined';
const DEBUG_AUTH =
  (isServer ? process.env.DEBUG_AUTH : process.env.NEXT_PUBLIC_DEBUG_AUTH) === 'true';

export const isDebugAuthEnabled = () => DEBUG_AUTH;

export const debugLog = (...args: unknown[]) => {
  if (DEBUG_AUTH) console.log(...args);
};

export const debugWarn = (...args: unknown[]) => {
  if (DEBUG_AUTH) console.warn(...args);
};

export const debugError = (...args: unknown[]) => {
  if (DEBUG_AUTH) console.error(...args);
};

export const debugTrace = (...args: unknown[]) => {
  if (DEBUG_AUTH) console.trace(...args);
};
