import {
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  getDay,
  format,
  addDays,
  subDays,
  differenceInCalendarDays,
} from "date-fns";

/**
 * Separación mínima (en días, en cualquier dirección) entre una guardia de
 * Urgencias y una guardia del servicio de origen del residente. Son guardias
 * de 24h y hace falta más margen que el descanso de un día entre guardias de
 * Urgencias consecutivas.
 */
export const OTHER_SERVICE_MIN_GAP_DAYS = 4;

export interface PostInput {
  id: string;
  slotsPerDay: number;
}

export interface ResidentInput {
  id: string;
  monthlyQuota: number;
  active: boolean;
  /** Nº de guardias ya realizadas en este servicio en meses anteriores (para repartir a largo plazo) */
  historicalCount: number;
  vacations: { start: Date; end: Date }[];
  avoidWeekdays: number[];
  /** Fechas concretas (ISO yyyy-MM-dd) a evitar dentro del mes */
  avoidDates: string[];
  /** Fechas concretas (ISO yyyy-MM-dd) preferidas dentro del mes (normalmente hasta 3) */
  preferredDates: string[];
  /** Si sale de guardia la noche del último día del mes anterior, no puede tener guardia el día 1 */
  outgoingFirstDay: boolean;
  /** Fechas (ISO yyyy-MM-dd) en las que tiene guardia de su servicio de origen (fuera de Urgencias) */
  otherServiceGuardiaDates: string[];
  preferredPostId?: string | null;
}

export interface GenerateScheduleInput {
  year: number;
  month: number; // 1-12
  posts: PostInput[];
  residents: ResidentInput[];
}

export interface GeneratedAssignment {
  postId: string;
  residentId: string;
  date: string; // ISO yyyy-MM-dd
}

export interface UnfilledSlot {
  postId: string;
  date: string;
}

export interface GenerateScheduleResult {
  assignments: GeneratedAssignment[];
  unfilledSlots: UnfilledSlot[];
  stats: { residentId: string; count: number }[];
}

function toISODate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/** Domingo=0 ... Sábado=6 */
function weekdayNumber(date: Date): number {
  return getDay(date);
}

/** Todos los días del mes (incluye fines de semana): el cuadrante cubre los 7 días de la semana. */
export function getScheduleDays(year: number, month: number): Date[] {
  const start = startOfMonth(new Date(year, month - 1, 1));
  const end = endOfMonth(start);
  return eachDayOfInterval({ start, end });
}

function isOnVacation(resident: ResidentInput, date: Date): boolean {
  return resident.vacations.some((v) => date >= v.start && date <= v.end);
}

function isBlockedAsOutgoing(resident: ResidentInput, date: Date): boolean {
  return resident.outgoingFirstDay && date.getDate() === 1;
}

/**
 * Demasiado cerca de una guardia de su servicio de origen (en cualquier
 * dirección): hace falta un margen de OTHER_SERVICE_MIN_GAP_DAYS días entre
 * una guardia de Urgencias y una de su propio servicio.
 */
function isTooCloseToOtherServiceGuardia(resident: ResidentInput, date: Date): boolean {
  return resident.otherServiceGuardiaDates.some((iso) => {
    const otherDate = new Date(`${iso}T00:00:00`);
    return Math.abs(differenceInCalendarDays(date, otherDate)) < OTHER_SERVICE_MIN_GAP_DAYS;
  });
}

/**
 * Una guardia de Urgencias son 24h seguidas: quien tiene guardia el día D
 * está de descanso (saliente) el día D+1 y no puede tener otra guardia de
 * Urgencias justo antes o después.
 */
function isRestDay(resident: ResidentInput, date: Date, assignedDayKey: Set<string>): boolean {
  const yesterday = subDays(date, 1);
  if (assignedDayKey.has(`${resident.id}|${toISODate(yesterday)}`)) return true;
  const tomorrow = addDays(date, 1);
  if (assignedDayKey.has(`${resident.id}|${toISODate(tomorrow)}`)) return true;
  return false;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Genera un borrador de cuadrante mensual con un algoritmo voraz ponderado:
 * en cada slot (puerta + día) elige, entre los residentes disponibles, el de
 * mejor puntuación. La puntuación prioriza primero el reparto equitativo
 * dentro del mes (nadie se lleva más guardias que otro hasta que todos
 * lleguen al mismo nivel), luego el histórico de guardias en meses previos,
 * y por último las preferencias del residente.
 */
export function generateSchedule(input: GenerateScheduleInput): GenerateScheduleResult {
  const days = getScheduleDays(input.year, input.month);

  interface Slot {
    day: Date;
    postId: string;
  }
  const slots: Slot[] = [];
  for (const day of days) {
    for (const post of input.posts) {
      for (let i = 0; i < post.slotsPerDay; i++) {
        slots.push({ day, postId: post.id });
      }
    }
  }
  const shuffledSlots = shuffle(slots);

  const assignedThisMonth = new Map<string, number>();
  const assignedDayKey = new Set<string>();
  for (const r of input.residents) assignedThisMonth.set(r.id, 0);

  const assignments: GeneratedAssignment[] = [];
  const unfilledSlots: UnfilledSlot[] = [];

  for (const slot of shuffledSlots) {
    const iso = toISODate(slot.day);
    const wd = weekdayNumber(slot.day);

    let best: ResidentInput | null = null;
    let bestScore = -Infinity;

    for (const r of input.residents) {
      if (!r.active) continue;
      if ((assignedThisMonth.get(r.id) ?? 0) >= r.monthlyQuota) continue;
      if (assignedDayKey.has(`${r.id}|${iso}`)) continue;
      if (isOnVacation(r, slot.day)) continue;
      if (isBlockedAsOutgoing(r, slot.day)) continue;
      if (isTooCloseToOtherServiceGuardia(r, slot.day)) continue;
      if (isRestDay(r, slot.day, assignedDayKey)) continue;

      let score = 0;
      score -= 1000 * (assignedThisMonth.get(r.id) ?? 0); // reparto equitativo este mes (prioridad máxima)
      score -= 5 * r.historicalCount; // reparto a largo plazo entre meses
      if (r.preferredDates.includes(iso)) score += 30;
      if (r.avoidWeekdays.includes(wd)) score -= 20;
      if (r.avoidDates.includes(iso)) score -= 40;
      if (r.preferredPostId && r.preferredPostId === slot.postId) score += 15;
      score += Math.random() * 5; // desempate aleatorio

      if (score > bestScore) {
        bestScore = score;
        best = r;
      }
    }

    if (best) {
      assignments.push({ postId: slot.postId, residentId: best.id, date: iso });
      assignedThisMonth.set(best.id, (assignedThisMonth.get(best.id) ?? 0) + 1);
      assignedDayKey.add(`${best.id}|${iso}`);
    } else {
      unfilledSlots.push({ postId: slot.postId, date: iso });
    }
  }

  const stats = Array.from(assignedThisMonth.entries()).map(([residentId, count]) => ({
    residentId,
    count,
  }));

  return { assignments, unfilledSlots, stats };
}
