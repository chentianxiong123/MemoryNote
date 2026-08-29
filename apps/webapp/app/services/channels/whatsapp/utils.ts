/**
 * WhatsApp utility stub.
 */

export function formatDailyWhatsAppTitle(
  titleOrDate: string | Date,
  _timezone: string = "UTC",
): string {
  return typeof titleOrDate === "string" ? titleOrDate : titleOrDate.toString();
}
