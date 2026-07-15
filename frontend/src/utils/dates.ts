/** Todos los días del mes (incluye fines de semana): el cuadrante cubre los 7 días de la semana. */
export function getScheduleDaysISO(year: number, month: number): string[] {
  const days: string[] = [];
  const date = new Date(year, month - 1, 1);
  while (date.getMonth() === month - 1) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    days.push(`${y}-${m}-${d}`);
    date.setDate(date.getDate() + 1);
  }
  return days;
}

const WEEKDAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export function weekdayShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return WEEKDAY_SHORT[d.getDay()];
}

export function formatDayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return `${weekdayShort(iso)} ${d.getDate()}`;
}
