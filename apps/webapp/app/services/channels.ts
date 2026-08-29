/**
 * Channel stub - only web channel active.
 */

export function getChannel(_channelType: string): { type: string; format: string } | null {
  return { type: "web", format: "{message}" };
}
