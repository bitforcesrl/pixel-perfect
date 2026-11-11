/**
 * Keep React's dev-only async tracking from taking the dev server down.
 *
 * In development the React server runtime installs a process-wide async hook
 * that records every I/O resource and every promise descended from one in a
 * `Map` (`pendingOperations`), to draw async stacks in the dev tools. That hook
 * sees everything in the process, not just rendering — a screenshot drives
 * Playwright through tens of thousands of protocol round-trips, each a chain
 * of promises, and the map hits V8's 2^24-entry ceiling. The hook then throws
 * `RangeError: Map maximum size exceeded` from inside `init`, which Node treats
 * as fatal and exits.
 *
 * Production builds never install the hook, so this only runs under
 * `next dev`: React's hook is still created, but enabling it does nothing.
 * The cost is the async I/O entries in React's dev performance track.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NODE_ENV !== 'development') return;

  const imported = await import('node:async_hooks');
  // The CommonJS exports object — the one the runtime's `require` gets, and
  // unlike the ESM namespace, one whose properties can be replaced
  const asyncHooks = (imported as unknown as {default?: typeof imported}).default ?? imported;
  const createHook = asyncHooks.createHook;

  asyncHooks.createHook = (callbacks) => {
    const hook = createHook(callbacks);
    if (!isReactDebugHook(callbacks)) return hook;
    hook.enable = () => hook;
    return hook;
  };
}

/** React's hook, told apart by its callbacks and by who is creating it. */
function isReactDebugHook(callbacks: import('node:async_hooks').HookCallbacks): boolean {
  if (!callbacks.init || !callbacks.promiseResolve || !callbacks.destroy) return false;
  const stack = new Error().stack ?? '';
  return /next-server[\\/]app-(page|route)|react-server-dom/.test(stack);
}
