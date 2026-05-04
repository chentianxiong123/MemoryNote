# @core/providers

Provider abstraction layer for MemoryNote. The package name still uses the
internal `@core/*` workspace namespace for compatibility.

## Supported Providers

### Graph Providers
- ✅ **Neo4j** - Production ready
- 🚧 **FalkorDB** - Coming soon
- 🚧 **HelixDB** - Coming soon

### Vector Providers
- 🚧 **pgvector** - Coming soon
- 🚧 **Turbopuffer** - Coming soon
- 🚧 **Qdrant** - Coming soon

### Model Providers
- 🚧 **Vercel AI SDK** - Coming soon

## Usage

```typescript
import { ProviderFactory } from "@core/providers";

// Initialize from environment variables
ProviderFactory.initializeFromEnv();

// Get providers
const graphProvider = ProviderFactory.getGraphProvider();
const vectorProvider = ProviderFactory.getVectorProvider();
const modelProvider = ProviderFactory.getModelProvider();
```

## Configuration

Set these environment variables:

```bash
# Graph Provider
GRAPH_PROVIDER=neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=

# Vector Provider (when implemented)
VECTOR_PROVIDER=pgvector
DATABASE_URL=postgresql://...

# Model Provider (when implemented)
MODEL_PROVIDER=vercel-ai
OPENAI_API_KEY=
```

## Adding New Providers

To add a new provider:

1. Implement the appropriate interface (IGraphProvider, IVectorProvider, or IModelProvider)
2. Add the provider to the factory's switch statement
3. Add configuration parsing in the factory
4. Update this README

See existing implementations for examples.
