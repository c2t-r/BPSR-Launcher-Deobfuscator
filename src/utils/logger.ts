/**
 * Simple logger utility for consistent log output across modules.
 */
export function createLogger(moduleName: string) {
  return {
    info: (msg: string) => console.log(`[${moduleName}] ${msg}`),
    detail: (msg: string) => console.log(`[${moduleName}]   └ ${msg}`),
  };
}
