export type Role = "ADMIN" | "RESIDENT";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface Resident {
  id: string;
  userId: string;
  residencyYear: number | null;
  monthlyQuota: number;
  user: { name: string; email: string; active?: boolean; role?: Role };
}

export interface Post {
  id: string;
  serviceId: string;
  name: string;
  slotsPerDay: number;
  order: number;
}

export interface Service {
  id: string;
  name: string;
  posts: Post[];
}

export interface Vacation {
  id: string;
  residentId: string;
  startDate: string;
  endDate: string;
  reason: string | null;
}

export interface Preference {
  id?: string;
  residentId: string;
  serviceId: string;
  year: number;
  month: number;
  preferredWeekdays: number[];
  avoidWeekdays: number[];
  avoidDates: string[];
  preferredPostId: string | null;
  notes?: string | null;
}

export interface ShiftAssignment {
  id: string;
  scheduleMonthId: string;
  postId: string;
  residentId: string;
  date: string;
  post: Post;
  resident: { id: string; user: { name: string; email: string } };
}

export interface ScheduleMonth {
  id: string;
  serviceId: string;
  year: number;
  month: number;
  status: "DRAFT" | "PUBLISHED";
  generatedAt: string | null;
  publishedAt: string | null;
  assignments: ShiftAssignment[];
}

export const WEEKDAY_LABELS: Record<number, string> = {
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
};
