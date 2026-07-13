import { describe, it, expect } from "vitest";
import { generateSchedule, getWorkingDays, ResidentInput } from "./generateSchedule";

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
    preferredPostId: null,
    ...overrides,
  }));
}

describe("generateSchedule", () => {
  it("fills every slot when there is enough capacity", () => {
    const residents = makeResidents(60);
    const result = generateSchedule({ year: 2026, month: 7, posts: POSTS, residents });

    const days = getWorkingDays(2026, 7);
    const expectedSlots = days.length * POSTS.length * 2;

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

    const days = getWorkingDays(2026, 7);
    const expectedSlots = days.length * POSTS.length * 2;

    expect(result.unfilledSlots.length).toBeGreaterThan(0);
    expect(result.assignments.length + result.unfilledSlots.length).toBe(expectedSlots);
  });

  it("distributes shifts fairly across residents when capacity roughly matches demand", () => {
    const days = getWorkingDays(2026, 7).length;
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
});
