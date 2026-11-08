// analytics 模块（抄 cognee modules/analytics/index.ts 核心）
// 用量统计：track 事件 + 会话。开源 stub（用量展示在 analytics 页从 API 读）。

export interface TrackEventParams {
  pageName?: string;
  eventName?: string;
  additionalProperties?: Record<string, unknown>;
  [key: string]: unknown;
}

export function trackPageView(..._args: unknown[]) {}
export function trackPageEvent(_params: TrackEventParams) {}
export function trackEvent(_params: TrackEventParams) {}
export function identifyUser(..._args: unknown[]) {}
export function getSessionId() { return ""; }
export function getSessionOrigin() { return ""; }
export function refreshSessionActivity() {}
export function getAnonymousId() { return ""; }
export function setAnonymousId(_id: string) {}
