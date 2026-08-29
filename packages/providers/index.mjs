// ESM wrapper for CJS module
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const cjsModule = require('./dist/index.js');

export const ProviderFactory = cjsModule.ProviderFactory;
export const PgVectorProvider = cjsModule.PgVectorProvider;
export const Neo4jGraphProvider = cjsModule.Neo4jGraphProvider;
export const VECTOR_NAMESPACES = cjsModule.VECTOR_NAMESPACES;
