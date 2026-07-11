const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function MonthPicker({
  year,
  month,
  onChange,
}: {
  year: number;
  month: number;
  onChange: (year: number, month: number) => void;
}) {
  function shift(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    onChange(y, m);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => shift(-1)}
        className="px-2 py-1 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-100"
      >
        ←
      </button>
      <span className="text-sm font-medium text-slate-800 w-36 text-center">
        {MONTH_NAMES[month - 1]} {year}
      </span>
      <button
        onClick={() => shift(1)}
        className="px-2 py-1 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-100"
      >
        →
      </button>
    </div>
  );
}
