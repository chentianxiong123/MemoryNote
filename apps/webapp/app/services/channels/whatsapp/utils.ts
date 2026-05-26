export function formatDailyWhatsAppTitle(
  titleOrDate: string | Date,
  timezone: string = "UTC",
): string {
  if (titleOrDate instanceof Date) {
    return titleOrDate.toLocaleDateString("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  return titleOrDate;
}
