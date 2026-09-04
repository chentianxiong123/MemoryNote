# MemoryNote 数据迁移指南

## 当前状态
- PostgreSQL: 54 张表，**0 条文档，0 条对话**
- Neo4j: 连接正常，**0 个节点**

## 数据迁移脚本

**位置**: `/mnt/shared/MemoryNote/migrate.sh`

### 使用方法

#### 1. 从 JSON 文件导入
```bash
# 单个文件
bash /mnt/shared/MemoryNote/migrate.sh --source json --file ./data/documents.json

# 批量导入目录
bash /mnt/shared/MemoryNote/migrate.sh --source json --dir ./data/
```

#### 2. 从 SQLite 导入（旧版 MemoryNote）
```bash
bash /mnt/shared/MemoryNote/migrate.sh --source sqlite --file ./old-memorynote.db
```

#### 3. 从 CSV 导入
```bash
bash /mnt/shared/MemoryNote/migrate.sh --source csv --file ./data.csv
```

## 需要的数据源

如果你之前有数据，可能在以下位置：
- 旧版 MemoryNote 的 SQLite 数据库
- JSON 导出文件
- CSV 文件
- 其他位置的数据备份

请提供数据文件路径，或放入 `/mnt/shared/MemoryNote/data/` 目录后运行迁移。

## JSON 数据格式示例

### 文档
```json
[
  {
    "title": "标题",
    "content": "内容",
    "source": "upload",
    "type": "text",
    "createdAt": "2024-01-01T00:00:00Z"
  }
]
```

### 对话
```json
[
  {
    "title": "对话标题",
    "messages": [
      {"role": "user", "content": "消息"},
      {"role": "assistant", "content": "回复"}
    ]
  }
]
```
