/**
 * Telemetry stub - all tracking disabled.
 * Replaces the original PostHog implementation that was sending data
 * to CORE's PostHog project.
 */

export type TelemetryEvent = string;

export function trackFeatureUsage(
  _event: string,
  _props?: Record<string, unknown>,
): Promise<void> {
  // No-op - telemetry disabled
  return Promise.resolve();
}
