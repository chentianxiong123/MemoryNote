/**
 * pipeline 运行状态 + 断点续跑（抄 Cognee memory_pipelines.py + recovery.py 核心）
 *
 * Cognee 两段 pipeline（indexing/cognify）各是一个 run（pipeline_runs 行），
 * 每项完成打戳（completion stamps），崩溃后从断点续跑。这里移植核心：
 *  - PipelineRun / PipelineRunStatus
 *  - 记录 run 进度（stage/tasks/events）
 *  - 断点续跑（从 stage 处继续）
 */

import { randomUUID } from "node:crypto";
import type { Store } from "../../store/pg.js";

export type PipelineRunStatus = "started" | "completed" | "errored" | "paused";
export type PipelineName = "indexing" | "cognify" | "memify";

/** 运行事件（抄 PipelineRunEvent） */
export interface RunEvent {
  at: Date;
  kind: "item_completed" | "run_started" | "run_completed" | "run_errored";
  detail?: string;
}

/** 运行信息（抄 PipelineRunInfo） */
export interface PipelineRun {
  id: string;
  pipeline: PipelineName;
  dataset: string;
  status: PipelineRunStatus;
  stage: string;
  /** 完成项（completion stamps，断点续跑判据） */
  completedItems: string[];
  totalItems: number;
  retry: number;
  events: RunEvent[];
  startedAt: Date;
  updatedAt: Date;
}

/** 运行账本（断点续跑核心，抄 cognee pipeline_runs + run-state 账本） */
export class RunState {
  constructor(private store: Store) {}

  /** 开始一个 run（抄 PipelineRunStarted） */
  async start(pipeline: PipelineName, dataset: string, totalItems: number): Promise<PipelineRun> {
    const run: PipelineRun = {
      id: randomUUID(), pipeline, dataset, status: "started", stage: "start",
      completedItems: [], totalItems, retry: 0,
      events: [{ at: new Date(), kind: "run_started" }],
      startedAt: new Date(), updatedAt: new Date(),
    };
    await this.save(run);
    return run;
  }

  /** 标记项完成（抄 completion stamps） */
  async markCompleted(runId: string, itemId: string): Promise<void> {
    const run = await this.get(runId);
    if (!run) return;
    if (!run.completedItems.includes(itemId)) run.completedItems.push(itemId);
    run.updatedAt = new Date();
    run.events.push({ at: new Date(), kind: "item_completed", detail: itemId });
    await this.save(run);
  }

  /** 更新 stage（断点续跑位置） */
  async setStage(runId: string, stage: string): Promise<void> {
    const run = await this.get(runId);
    if (!run) return;
    run.stage = stage;
    run.updatedAt = new Date();
    await this.save(run);
  }

  /** 完成/报错 run */
  async finish(runId: string, status: "completed" | "errored", detail?: string): Promise<void> {
    const run = await this.get(runId);
    if (!run) return;
    run.status = status;
    run.updatedAt = new Date();
    run.events.push({ at: new Date(), kind: status === "completed" ? "run_completed" : "run_errored", detail });
    await this.save(run);
  }

  /** 断点续跑：找未完成的项（抄 recovery：completedItems 之外） */
  pendingItems(run: PipelineRun): string[] {
    const all = Array.from({ length: run.totalItems }, (_, i) => String(i));
    return all.filter((i) => !run.completedItems.includes(i));
  }

  /**
   * 恢复未完成的 run（抄 recover_stale_pipeline_runs_on_startup）
   * 超时未完成的 run 标记为 errored（abandoned），可重跑；否则返回可续跑的 run。
   */
  async recoverStaleRuns(staleMs = 6 * 60 * 60 * 1000): Promise<Array<{ run: PipelineRun; resumable: boolean }>> {
    const res = await this.store.query(
      `SELECT id FROM pipeline_runs WHERE status IN ('started', 'paused')`
    );
    const result: Array<{ run: PipelineRun; resumable: boolean }> = [];
    for (const row of res.rows) {
      const run = await this.get(row.id as string);
      if (!run) continue;
      const age = Date.now() - run.updatedAt.getTime();
      if (age > staleMs) {
        // 超时：标记 abandoned（errored），不再续跑
        run.status = "errored";
        run.events.push({ at: new Date(), kind: "run_errored", detail: "abandoned (stale)" });
        await this.save(run);
        result.push({ run, resumable: false });
      } else {
        // 未超时：可续跑（断点续跑）
        result.push({ run, resumable: true });
      }
    }
    return result;
  }

  /**
   * 回滚 run（抄 cognify_rollback_handler）
   * 清完成项 + 标记 errored，可重跑。
   */
  async rollback(runId: string): Promise<PipelineRun | null> {
    const run = await this.get(runId);
    if (!run) return null;
    run.completedItems = [];
    run.status = "errored";
    run.stage = "start";
    run.events.push({ at: new Date(), kind: "run_errored", detail: "rollback" });
    await this.save(run);
    return run;
  }

  async get(runId: string): Promise<PipelineRun | null> {
    const res = await this.store.query(
      `SELECT id, pipeline, dataset, status, stage, completed_items, total_items, retry, events, started_at, updated_at
       FROM pipeline_runs WHERE id = $1`, [runId]
    );
    if (!res.rows[0]) return null;
    return this.rowToRun(res.rows[0]);
  }

  private async save(run: PipelineRun): Promise<void> {
    await this.store.query(
      `INSERT INTO pipeline_runs (id, pipeline, dataset, status, stage, completed_items, total_items, retry, events, started_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (id) DO UPDATE SET status=$4, stage=$5, completed_items=$6, total_items=$7, retry=$8, events=$9, updated_at=$11`,
      [run.id, run.pipeline, run.dataset, run.status, run.stage, run.completedItems, run.totalItems,
       run.retry, JSON.stringify(run.events), run.startedAt.toISOString(), run.updatedAt.toISOString()]
    );
  }

  private rowToRun(r: Record<string, unknown>): PipelineRun {
    return {
      id: r.id as string, pipeline: r.pipeline as PipelineName, dataset: r.dataset as string,
      status: r.status as PipelineRunStatus, stage: r.stage as string,
      completedItems: (r.completed_items as string[]) ?? [], totalItems: (r.total_items as number) ?? 0,
      retry: (r.retry as number) ?? 0, events: (r.events as RunEvent[]) ?? [],
      startedAt: new Date(r.started_at as string), updatedAt: new Date(r.updated_at as string),
    };
  }
}
