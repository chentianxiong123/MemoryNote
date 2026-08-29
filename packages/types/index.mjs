// ESM wrapper for CJS module
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const cjsModule = require('./dist/index.js');

// Re-export everything from CJS module
for (const [key, value] of Object.entries(cjsModule)) {
  if (!(key in globalThis)) {
    // We can't directly export, so just log for now
    console.log('Export:', key);
  }
}

// Explicit exports
export const * as llm from './dist/llm/index.js';
export const * as graph from './dist/graph/index.js';
export const * as search from './dist/search/index.js';
