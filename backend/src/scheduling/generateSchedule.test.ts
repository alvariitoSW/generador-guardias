import { describe, it, expect } from "vitest";
import { generateSchedule, getScheduleDays, ResidentInput } from "./generateSchedule";

const POSTS = [
  { id: "p1", slotsPerDay: 2 },
  { id: "p2", slotsPerDay: 2 },
  { id: "p3", slotsPerDay: 2 },
  { id: "p4", slotsPerDay: 2 },
];

function makeResidents(count: number, overrides: Partial<ResidentInput> = {}): ResidentInput[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `r${i}`,
    monthlyQuota: 4,
    active: true,
    historicalCount: 0,
    vacations: [],
    avoidWeekdays: [],
    avoidDates: [],
    preferredDates: [],
    outgoingFirstDay: false,
    otherServiceGuardiaDates: [],
    preferredPostId: null,
    ...overrides,
  }));
}

describe("generateSchedule", () => {
  it("fills every slot when there is enough capacity", () => {
    const days = getScheduleDays(2026, 7);
    const expectedSlots = days.length * POSTS.length * 2;
    // Algo de margen sobre el mínimo teórico (huecos/4): con la capacidad justa,
    // la regla de descanso de 24h puede dejar algún hueco imposible de cubrir.
    const residents = makeResidents(Math.ceil((expectedSlots / 4) * 1.3));
    const result = generateSchedule({ year: 2026, month: 7, posts: POSTS, residents });

    expect(result.assignments.length).toBe(expectedSlots);
    expect(result.unfilledSlots.length).toBe(0);
  });

  it("never assigns the same resident to two slots the same day", () => {
    const residents = makeResidents(60);
    const result = generateSchedule({ year: 2026, month: 7, posts: POSTS, residents });

    const seen = new Set<string>();
    for (const a of result.assignments) {
      const key = `${a.residentId}|${a.date}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("never exceeds a resident's monthly quota", () => {
    const residents = makeResidents(60, { monthlyQuota: 4 });
    const result = generateSchedule({ year: 2026, month: 7, posts: POSTS, residents });

    const counts = new Map<string, number>();
    for (const a of result.assignments) {
      counts.set(a.residentId, (counts.get(a.residentId) ?? 0) + 1);
    }
    for (const count of counts.values()) {
      expect(count).toBeLessThanOrEqual(4);
    }
  });

  it("respects each resident's own quota when someone declares fewer guardias than the default", () => {
    const residents = makeResidents(60, { monthlyQuota: 4 });
    residents[0].monthlyQuota = 2; // ha declarado que este mes hace menos

    const result = generateSchedule({ year: 2026, month: 7, posts: POSTS, residents });
    const counts = new Map<string, number>();
    for (const a of result.assignments) {
      counts.set(a.residentId, (counts.get(a.residentId) ?? 0) + 1);
    }

    expect(counts.get("r0") ?? 0).toBeLessThanOrEqual(2);
    // el resto sigue pudiendo llegar a su objetivo habitual de 4
    expect(Math.max(...Array.from(counts.entries()).filter(([id]) => id !== "r0").map(([, c]) => c))).toBe(4);
  });

  it("respects vacations", () => {
    const residents = makeResidents(60);
    // r0 de vacaciones todo el mes
    residents[0].vacations = [{ start: new Date(2026, 6, 1), end: new Date(2026, 6, 31) }];

    const result = generateSchedule({ year: 2026, month: 7, posts: POSTS, residents });
    const r0Assignments = result.assignments.filter((a) => a.residentId === "r0");
    expect(r0Assignments.length).toBe(0);
  });

  it("reports unfilled slots when there is not enough capacity instead of crashing", () => {
    const residents = makeResidents(5, { monthlyQuota: 4 }); // muy pocos residentes
    const result = generateSchedule({ year: 2026, month: 7, posts: POSTS, residents });

    const days = getScheduleDays(2026, 7);
    const expectedSlots = days.length * POSTS.length * 2;

    expect(result.unfilledSlots.length).toBeGreaterThan(0);
    expect(result.assignments.length + result.unfilledSlots.length).toBe(expectedSlots);
  });

  it("distributes shifts fairly across residents when capacity roughly matches demand", () => {
    const days = getScheduleDays(2026, 7).length;
    const totalSlots = days * POSTS.length * 2;
    const residentCount = Math.ceil(totalSlots / 4);
    const residents = makeResidents(residentCount, { monthlyQuota: 4 });

    const result = generateSchedule({ year: 2026, month: 7, posts: POSTS, residents });
    const counts = result.stats.map((s) => s.count);
    const max = Math.max(...counts);
    const min = Math.min(...counts);
    expect(max - min).toBeLessThanOrEqual(1);
  });

  it("never assigns day 1 to a resident marked as outgoing from the previous month", () => {
    const residents = makeResidents(60);
    residents[0].outgoingFirstDay = true;

    const result = generateSchedule({ year: 2026, month: 7, posts: POSTS, residents });
    const day1Assignments = result.assignments.filter((a) => a.residentId === "r0" && a.date === "2026-07-01");
    expect(day1Assignments.length).toBe(0);
    // el resto del mes sigue disponible para guardias
    const otherAssignments = result.assignments.filter((a) => a.residentId === "r0");
    expect(otherAssignments.length).toBeGreaterThan(0);
  });

  it("favors a resident's preferred dates over an equally-available colleague", () => {
    // Ambos solo están disponibles el 1 de julio (el resto del mes de vacaciones),
    // así que compiten por el único hueco de ese día; solo r0 lo prefiere.
    const restOfMonthOff = { start: new Date(2026, 6, 2), end: new Date(2026, 6, 31) };
    const residents = makeResidents(2, { monthlyQuota: 10, vacations: [restOfMonthOff] });
    residents[0].preferredDates = ["2026-07-01"];

    const onePost = [{ id: "p1", slotsPerDay: 1 }];
    const result = generateSchedule({ year: 2026, month: 7, posts: onePost, residents });

    const day1 = result.assignments.find((a) => a.date === "2026-07-01");
    expect(day1?.residentId).toBe("r0");
  });

  it("never assigns the same resident two calendar-adjacent days (24h rest rule)", () => {
    const residents = makeResidents(60);
    const result = generateSchedule({ year: 2026, month: 7, posts: POSTS, residents });

    const byResident = new Map<string, string[]>();
    for (const a of result.assignments) {
      byResident.set(a.residentId, [...(byResident.get(a.residentId) ?? []), a.date]);
    }
    for (const dates of byResident.values()) {
      const sorted = [...dates].sort();
      for (let i = 1; i < sorted.length; i++) {
        const prev = new Date(`${sorted[i - 1]}T00:00:00`);
        const next = new Date(`${sorted[i]}T00:00:00`);
        const diffDays = (next.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
        expect(diffDays).toBeGreaterThan(1);
      }
    }
  });

  it("keeps a minimum 4-day gap around a guardia of the resident's other service", () => {
    const residents = makeResidents(60);
    // 2026-07-13 es lunes; el hueco bloqueado (diferencia < 4 días) va del 10 al 16 de julio.
    residents[0].otherServiceGuardiaDates = ["2026-07-13"];

    const result = generateSchedule({ year: 2026, month: 7, posts: POSTS, residents });
    const r0Dates = result.assignments.filter((a) => a.residentId === "r0").map((a) => a.date);

    for (const blocked of ["2026-07-10", "2026-07-13", "2026-07-14", "2026-07-15", "2026-07-16"]) {
      expect(r0Dates).not.toContain(blocked);
    }
    expect(r0Dates.length).toBeGreaterThan(0);
  });

  it("allows a guardia exactly at the minimum gap boundary (4 days away)", () => {
    // Solo disponible el 2026-07-09 (diferencia exacta de 4 días respecto al
    // 2026-07-13, el resto del mes bloqueado por vacaciones): si el hueco se
    // cubre es porque el margen de 4 días sí lo permite.
    const vacations = [
      { start: new Date(2026, 6, 1), end: new Date(2026, 6, 8) },
      { start: new Date(2026, 6, 10), end: new Date(2026, 6, 31) },
    ];
    const residents = makeResidents(1, { monthlyQuota: 10, vacations });
    residents[0].otherServiceGuardiaDates = ["2026-07-13"];

    const onePost = [{ id: "p1", slotsPerDay: 1 }];
    const result = generateSchedule({ year: 2026, month: 7, posts: onePost, residents });

    const day9 = result.assignments.find((a) => a.date === "2026-07-09");
    expect(day9?.residentId).toBe("r0");
    expect(result.assignments.length).toBe(1);
  });
});
