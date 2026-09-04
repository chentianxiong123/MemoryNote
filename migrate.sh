#!/bin/bash
# MemoryNote 数据迁移脚本
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/packages/database"
TXS_LOADER="$SCRIPT_DIR/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/loader.mjs"
node --import "$TXS_LOADER" scripts/migrate-data.ts "$@"
