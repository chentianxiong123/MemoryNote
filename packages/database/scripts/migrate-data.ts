#!/usr/bin/env node
/**
 * MemoryNote 数据迁移工具
 * 
 * 支持的数据源：
 * 1. JSON 文件 - 按格式导入文档和对话
 * 2. SQLite 数据库 - 从旧版 MemoryNote 迁移
 * 3. CSV 文件 - 批量导入文档
 * 4. Neo4j 备份 - 从旧图数据库恢复
 * 
 * 使用方法：
 *   npx tsx scripts/migrate-data.ts --source <json|sqlite|csv|neo4j> --file <path>
 *   npx tsx scripts/migrate-data.ts --source json --dir ./data
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '../..');

// 读取环境变量
const DB_URL = process.env.DATABASE_URL || 'postgresql://docker:docker@localhost:5432/memorynote?schema=memorynote';
const NEO4J_URI = process.env.NEO4J_URI || 'bolt://localhost:7687';
const NEO4J_USER = process.env.NEO4J_USERNAME || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'docker1234';

const prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });

// 解析命令行参数
function parseArgs(): Record<string, string> {
  const args = process.argv.slice(2);
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      result[args[i].slice(2)] = args[i + 1] || '';
      i++;
    }
  }
  return result;
}

// 日志工具
function log(msg: string, type: 'info' | 'success' | 'error' = 'info') {
  const prefix = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  console.log(`[${type.toUpperCase()}] ${prefix} ${msg}`);
}

// 导入文档
async function importDocuments(docs: Array<{
  title: string;
  content: string;
  source?: string;
  type?: string;
  createdAt?: string;
  labelIds?: string[];
  metadata?: Record<string, any>;
}>, workspaceId: string = 'personal'): Promise<number> {
  let imported = 0;
  for (const doc of docs) {
    try {
      await prisma.document.create({
        data: {
          id: crypto.randomUUID(),
          title: doc.title,
          content: doc.content,
          source: doc.source || 'migration',
          type: doc.type || 'text',
          workspaceId,
          userId: 'personal',
          editedBy: 'migration',
          labelIds: doc.labelIds || [],
          metadata: doc.metadata || {},
          createdAt: doc.createdAt ? new Date(doc.createdAt) : new Date(),
          updatedAt: new Date(),
        },
      });
      imported++;
      if (imported % 100 === 0) {
        log(`已导入 ${imported} 条文档...`);
      }
    } catch (err) {
      log(`导入文档 "${doc.title}" 失败: ${err}`, 'error');
    }
  }
  return imported;
}

// 导入对话
async function importConversations(convs: Array<{
  title: string;
  messages: Array<{ role: string; content: string; createdAt?: string }>;
  createdAt?: string;
  source?: string;
}>, workspaceId: string = 'personal'): Promise<number> {
  let imported = 0;
  for (const conv of convs) {
    try {
      const conversation = await prisma.conversation.create({
        data: {
          id: crypto.randomUUID(),
          title: conv.title,
          workspaceId,
          userId: 'personal',
          source: conv.source || 'migration',
          createdAt: conv.createdAt ? new Date(conv.createdAt) : new Date(),
          updatedAt: new Date(),
          history: conv.messages.map((m, i) => ({
            id: crypto.randomUUID(),
            role: m.role,
            content: m.content,
            createdAt: m.createdAt ? new Date(m.createdAt) : new Date(),
            sortOrder: i,
          })),
        },
      });
      
      // 为每条消息创建 Document
      for (const msg of conv.messages) {
        await prisma.document.create({
          data: {
            id: crypto.randomUUID(),
            title: `${conv.title} - ${msg.role}`,
            content: msg.content,
            source: 'conversation',
            type: msg.role,
            workspaceId,
            userId: 'personal',
            editedBy: 'migration',
            sessionId: conversation.id,
            createdAt: msg.createdAt ? new Date(msg.createdAt) : new Date(),
            updatedAt: new Date(),
          },
        });
      }
      
      imported++;
      if (imported % 10 === 0) {
        log(`已导入 ${imported} 条对话...`);
      }
    } catch (err) {
      log(`导入对话 "${conv.title}" 失败: ${err}`, 'error');
    }
  }
  return imported;
}

// 从 JSON 文件导入
async function migrateFromJson(fileOrDir: string): Promise<void> {
  const stat = fs.statSync(fileOrDir);
  const files = stat.isDirectory() 
    ? fs.readdirSync(fileOrDir).filter(f => f.endsWith('.json')).map(f => path.join(fileOrDir, f))
    : [fileOrDir];
  
  let totalDocs = 0;
  let totalConvs = 0;
  
  for (const file of files) {
    log(`处理文件: ${file}`);
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    
    // 支持多种格式
    if (Array.isArray(data)) {
      // 扁平数组格式
      const docs = data.filter((item: any) => item.content || item.text || item.message);
      totalDocs += await importDocuments(docs);
      
      const convs = data.filter((item: any) => item.messages || item.history);
      totalConvs += await importConversations(convs);
    } else if (data.documents) {
      totalDocs += await importDocuments(data.documents);
    }
    if (data.conversations) {
      totalConvs += await importConversations(data.conversations);
    }
    if (data.docs) {
      totalDocs += await importDocuments(data.docs);
    }
    if (data.convs || data.conversations) {
      totalConvs += await importConversations(data.convs || data.conversations);
    }
  }
  
  log(`JSON 导入完成: ${totalDocs} 条文档, ${totalConvs} 条对话`, 'success');
}

// 从 SQLite 导入
async function migrateFromSQLite(dbPath: string): Promise<void> {
  const sqlite3 = require('sqlite3').verbose();
  const sqlite = new sqlite3.Database(dbPath);
  
  log(`连接 SQLite: ${dbPath}`);
  
  // 查询文档
  const documents: any[] = await new Promise((resolve) => {
    sqlite.all('SELECT * FROM Document', (err: any, rows: any[]) => {
      resolve(err ? [] : rows);
    });
  });
  
  // 查询对话
  const conversations: any[] = await new Promise((resolve) => {
    sqlite.all('SELECT * FROM Conversation', (err: any, rows: any[]) => {
      resolve(err ? [] : rows);
    });
  });
  
  // 查询历史消息
  const histories: any[] = await new Promise((resolve) => {
    sqlite.all('SELECT * FROM ConversationHistory', (err: any, rows: any[]) => {
      resolve(err ? [] : rows);
    });
  });
  
  // 转换并导入
  const docs = documents.map((d: any) => ({
    title: d.title || 'Untitled',
    content: d.content || '',
    source: d.source || 'sqlite',
    type: d.type || 'text',
    createdAt: d.createdAt,
    labelIds: d.labelIds ? JSON.parse(d.labelIds) : [],
    metadata: d.metadata ? JSON.parse(d.metadata) : {},
  }));
  
  const convMap = new Map<string, any[]>();
  for (const h of histories) {
    if (!convMap.has(h.conversationId)) {
      convMap.set(h.conversationId, []);
    }
    convMap.get(h.conversationId)!.push({
      role: h.role,
      content: h.content,
      createdAt: h.createdAt,
    });
  }
  
  const convs = conversations.map((c: any) => ({
    title: c.title || 'Untitled',
    messages: convMap.get(c.id) || [],
    createdAt: c.createdAt,
    source: c.source || 'sqlite',
  }));
  
  log(`找到 ${documents.length} 条文档, ${conversations.length} 条对话`);
  
  const importedDocs = await importDocuments(docs);
  const importedConvs = await importConversations(convs);
  
  log(`SQLite 导入完成: ${importedDocs} 条文档, ${importedConvs} 条对话`, 'success');
  
  sqlite.close();
}

// 从 CSV 导入
async function migrateFromCsv(csvPath: string): Promise<void> {
  const fs = require('fs');
  const data = fs.readFileSync(csvPath, 'utf-8');
  const lines = data.split('\n').filter(l => l.trim());
  
  if (lines.length < 2) {
    log('CSV 文件为空', 'error');
    return;
  }
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const docs = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
    const doc: any = {};
    headers.forEach((h, idx) => {
      doc[h] = values[idx] || '';
    });
    docs.push({
      title: doc.title || doc.filename || 'Untitled',
      content: doc.content || doc.text || '',
      source: doc.source || 'csv',
      createdAt: doc.created_at || doc.date,
    });
  }
  
  const imported = await importDocuments(docs);
  log(`CSV 导入完成: ${imported} 条文档`, 'success');
}

// 主函数
async function main() {
  const args = parseArgs();
  const source = args.source;
  const file = args.file || args.path || args.dir;
  
  if (!source || !file) {
    console.log(`
MemoryNote 数据迁移工具

用法:
  npx tsx scripts/migrate-data.ts --source <json|sqlite|csv> --file <path>
  npx tsx scripts/migrate-data.ts --source json --dir <directory>

参数:
  --source   数据源类型: json, sqlite, csv
  --file     单个文件路径
  --dir      目录路径（用于 JSON 批量导入）

示例:
  npx tsx scripts/migrate-data.ts --source json --file ./backup/documents.json
  npx tsx scripts/migrate-data.ts --source sqlite --file ./old-memorynote.db
  npx tsx scripts/migrate-data.ts --source csv --file ./data.csv
`);
    process.exit(1);
  }
  
  try {
    switch (source) {
      case 'json':
        await migrateFromJson(file);
        break;
      case 'sqlite':
        await migrateFromSQLite(file);
        break;
      case 'csv':
        await migrateFromCsv(file);
        break;
      default:
        log(`不支持的数据源类型: ${source}`, 'error');
        process.exit(1);
    }
    
    // 显示统计
    const [docCount, convCount] = await Promise.all([
      prisma.document.count(),
      prisma.conversation.count(),
    ]);
    log(`数据库统计: ${docCount} 条文档, ${convCount} 条对话`, 'success');
    
  } catch (err) {
    log(`迁移失败: ${err}`, 'error');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
