import type { Job } from "@/lib/hooks/useJobs";

export type RevenuePoint = { label: string; value: number };

export function dateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfWeek(value: Date): Date {
  const next = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  next.setDate(next.getDate() - ((next.getDay() + 6) % 7));
  return next;
}

export function monthBounds(value: Date) {
  return {
    from: new Date(value.getFullYear(), value.getMonth(), 1),
    to: new Date(value.getFullYear(), value.getMonth() + 1, 0),
  };
}

function activeJobs(jobs: Job[]) {
  return jobs.filter((job) => job.status !== "cancelled");
}

export function jobsByDay(jobs: Job[]): Map<string, Job[]> {
  const grouped = new Map<string, Job[]>();
  activeJobs(jobs).forEach((job) => {
    const key = dateKey(new Date(job.scheduled_at));
    grouped.set(key, [...(grouped.get(key) ?? []), job]);
  });
  return grouped;
}

export function weeklyRevenue(jobs: Job[], weekStart: Date): RevenuePoint[] {
  const grouped = jobsByDay(jobs);
  return Array.from({ length: 7 }, (_, index) => {
    const day = addDays(weekStart, index);
    const value = (grouped.get(dateKey(day)) ?? []).reduce(
      (total, job) => total + (Number(job.price) || 0),
      0,
    );
    return { label: day.toLocaleDateString(undefined, { weekday: "narrow" }), value };
  });
}

export function money(value: number): string {
  return value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}