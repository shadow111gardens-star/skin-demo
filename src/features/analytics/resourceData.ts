import type { ClinicState } from "../../data";
import { addDays } from "../../services";
import { round } from "../finance/ledger";
import type { ReportRow } from "./selectors";
export function closedMaintenanceRows(
  s: ClinicState,
  from: string,
  to: string,
): ReportRow[] {
  const lower = new Date(from + "T00:00:00+05:30").getTime(),
    upper = new Date(addDays(to, 1) + "T00:00:00+05:30").getTime();
  const groups = new Map<
    string,
    { start: number; end: number; ids: string[]; names: string[] }[]
  >();
  for (const r of s.records.Maintenance) {
    const d = r.maintenance;
    if (r.status !== "Completed" || !d?.startedAt || !d.clearedAt) continue;
    const start = Math.max(lower, new Date(d.startedAt).getTime()),
      end = Math.min(upper, new Date(d.clearedAt).getTime());
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
      continue;
    const key = r.machineId || r.id;
    groups.set(key, [
      ...(groups.get(key) || []),
      { start, end, ids: [r.id], names: [r.name] },
    ]);
  }
  const rows: ReportRow[] = [];
  for (const [machineId, windows] of groups) {
    const merged: typeof windows = [];
    for (const window of windows.sort((a, b) => a.start - b.start)) {
      const last = merged.at(-1);
      if (last && window.start <= last.end) {
        last.end = Math.max(last.end, window.end);
        last.ids.push(...window.ids);
        last.names.push(...window.names);
      } else
        merged.push({
          ...window,
          ids: [...window.ids],
          names: [...window.names],
        });
    }
    for (const window of merged)
      rows.push({
        id: "downtime-" + window.ids.join("-"),
        label:
          s.records["Machines & Equipment"].find((m) => m.id === machineId)
            ?.name || "Documented asset",
        date: new Date(window.start + 19800000).toISOString().slice(0, 10),
        detail:
          window.names.join("; ") +
          " · closed service windows; overlapping intervals on the same asset merged",
        value: round((window.end - window.start) / 3600000),
        unit: "hours",
        href: "/maintenance?machine=" + machineId,
      });
  }
  return rows;
}
