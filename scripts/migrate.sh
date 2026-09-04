#!/bin/bash
# MemoryNote 数据迁移脚本
cd "$(dirname "$0")/.."
node --import ./node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/loader.mjs scripts/migrate-data.ts "$@"
