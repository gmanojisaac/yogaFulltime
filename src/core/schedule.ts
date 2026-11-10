import { Temporal } from "@js-temporal/polyfill";

export interface Schedule {
  localDate: string;
  startTime: string;
  timeZone: string;
  startsAt: string;
}
export function validTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    return zone.length <= 100;
  } catch {
    return false;
  }
}
export function localDate(timeZone: string, now = Date.now()): string {
  return Temporal.Instant.fromEpochMilliseconds(now)
    .toZonedDateTimeISO(timeZone)
    .toPlainDate()
    .toString();
}
export function createSchedule(
  date: string,
  startTime: string,
  timeZone: string,
): Schedule {
  // Reject nonexistent or repeated wall times rather than silently changing the user's choice.
  const zoned = Temporal.ZonedDateTime.from(
    `${date}T${startTime}[${timeZone}]`,
    { disambiguation: "reject" },
  );
  return {
    localDate: date,
    startTime,
    timeZone,
    startsAt: zoned.toInstant().toString(),
  };
}
export function scheduledInstant(
  schedule: Schedule,
  offsetMinutes: number,
): string {
  return Temporal.Instant.from(schedule.startsAt)
    .add({ minutes: offsetMinutes })
    .toString();
}
export function clock(
  instant: string,
  timeZone: string,
  withDate = false,
): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    ...(withDate ? { day: "numeric", month: "short" } : {}),
  }).format(new Date(instant));
}
export function elapsedLabel(minutes: number): string {
  return `+${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}
