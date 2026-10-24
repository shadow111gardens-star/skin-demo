import { useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { inr } from "../finance/ledger";
import type { ReportRow } from "./selectors";
import { chartColors } from '../../designSystem';
export { chartColors };
export interface TrendPoint {
  date: string;
  end: string;
  [key: string]: string | number;
}
export interface SeriesConfig {
  key: string;
  label: string;
  color?: string;
}
const numberLabel = (value: number, currency: boolean) =>
  currency
    ? Math.abs(value) >= 1000
      ? "₹" +
        (value / 1000).toLocaleString("en-IN", { maximumFractionDigits: 1 }) +
        "k"
      : inr(value)
    : String(value);
export function TrendChart({
  title,
  description,
  data,
  series,
  currency = false,
  onInspect,
}: {
  title: string;
  description: string;
  data: TrendPoint[];
  series: SeriesConfig[];
  currency?: boolean;
  onInspect: (key: string, from?: string, to?: string) => void;
}) {
  const [table, setTable] = useState(false),
    nonzero = data.some((d) => series.some((s) => Number(d[s.key]) !== 0));
  return (
    <section className="card analytics-chart">
      <header>
        <h2>{title}</h2>
        <p>{description}</p>
      </header>
      <div className="analytics-legend" aria-label={title + " legend"}>
        {series.map((s, i) => (
          <button
            key={s.key}
            onClick={() => onInspect(s.key)}
            aria-label={"View records for " + s.label}
          >
            <i style={{ background: s.color || chartColors[i % 4] }} />
            {s.label}
          </button>
        ))}
      </div>
      {nonzero ? (
        <div
          className="analytics-plot"
          role="img"
          aria-label={
            title +
            "; " +
            (currency ? "INR" : "record counts") +
            "; " +
            data[0]?.date +
            " to " +
            data.at(-1)?.end
          }
        >
          <ResponsiveContainer width="100%" height={265}>
            <AreaChart
              data={data}
              margin={{ top: 10, right: 12, bottom: 5, left: 0 }}
              accessibilityLayer
              onClick={(e) => {
                if (e?.activeLabel) {
                  const p = data.find((d) => d.date === String(e.activeLabel));
                  if (p) onInspect(series[0].key, p.date, p.end);
                }
              }}
            >
              <CartesianGrid
                stroke="#e7ece2"
                strokeDasharray="3 5"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tickFormatter={(s) => String(s).slice(5)}
                tick={{ fontSize: 11, fill: "var(--color-muted)" }}
                minTickGap={35}
              />
              <YAxis
                width={55}
                allowDecimals={currency}
                tickFormatter={(n) => numberLabel(Number(n), currency)}
                tick={{ fontSize: 11, fill: "var(--color-muted)" }}
              />
              <Tooltip
                formatter={(v) => (currency ? inr(Number(v)) : String(v))}
                labelFormatter={(label) => String(label)}
              />
              {series.map((s, i) => (
                <Area
                  key={s.key}
                  name={s.label}
                  dataKey={s.key}
                  type="monotone"
                  stroke={s.color || chartColors[i % 4]}
                  fill={s.color || chartColors[i % 4]}
                  fillOpacity={i === 0 ? 0.11 : 0.035}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="analytics-empty">
          No recorded activity in this range for these series.
        </div>
      )}
      <button
        className="analytics-data-toggle"
        aria-expanded={table}
        onClick={() => setTable(!table)}
      >
        {table ? "Hide" : "Show"} chart values
      </button>
      {table && (
        <div className="analytics-chart-values">
          {data.map((d) => (
            <div key={d.date}>
              <strong>
                {d.date}
                {d.date !== d.end ? " – " + d.end : ""}
              </strong>
              {series.map((s) => (
                <span key={s.key}>
                  {s.label}:{" "}
                  {currency ? inr(Number(d[s.key])) : String(d[s.key])}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
export interface BarDatum {
  name: string;
  value: number;
  rows: ReportRow[];
}
export function BreakdownChart({
  title,
  description,
  data,
  unit,
  onInspect,
}: {
  title: string;
  description: string;
  data: BarDatum[];
  unit: "INR" | "%" | "count" | "minutes";
  onInspect: (datum: BarDatum) => void;
}) {
  const [table, setTable] = useState(false),
    nonzero = data.some((d) => d.value !== 0);
  return (
    <section className="card analytics-chart">
      <header>
        <h2>{title}</h2>
        <p>{description}</p>
      </header>
      {nonzero ? (
        <div
          className="analytics-plot analytics-bar-plot"
          role="img"
          aria-label={title + "; " + unit}
        >
          <ResponsiveContainer
            width="100%"
            height={Math.max(240, data.length * 42)}
          >
            <BarChart
              data={data}
              layout="vertical"
              margin={{ left: 0, right: 15, top: 5, bottom: 5 }}
              accessibilityLayer
            >
              <CartesianGrid
                stroke="#e7ece2"
                strokeDasharray="3 5"
                horizontal={false}
              />
              <XAxis
                type="number"
                tickFormatter={(n) => numberLabel(Number(n), unit === "INR")}
                tick={{ fontSize: 10 }}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={105}
                tick={{ fontSize: 11, fill: "var(--color-muted)" }}
                tickFormatter={(n) =>
                  String(n).length > 17
                    ? String(n).slice(0, 15) + "…"
                    : String(n)
                }
              />
              <Tooltip
                formatter={(v) =>
                  unit === "INR"
                    ? inr(Number(v))
                    : String(v) +
                      (unit === "%" ? "%" : unit === "minutes" ? " min" : "")
                }
              />
              <Bar
                dataKey="value"
                name={unit}
                fill="var(--color-primary)"
                radius={[0, 5, 5, 0]}
                maxBarSize={18}
                isAnimationActive={false}
                onClick={(entry) => {
                  const selected = data.find(
                    (d) => d.name === (entry.payload?.name || entry.name),
                  );
                  if (selected) onInspect(selected);
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="analytics-empty">
          No recorded activity in this range.
        </div>
      )}
      <div className="analytics-legend">
        {data.map((d) => (
          <button
            key={d.name}
            onClick={() => onInspect(d)}
            aria-label={"View records for " + d.name}
          >
            {d.name}{" "}
            <strong>
              {unit === "INR"
                ? inr(d.value)
                : d.value +
                  (unit === "%" ? "%" : unit === "minutes" ? " min" : "")}
            </strong>
          </button>
        ))}
      </div>
      <button
        className="analytics-data-toggle"
        aria-expanded={table}
        onClick={() => setTable(!table)}
      >
        {table ? "Hide" : "Show"} chart values
      </button>
      {table && (
        <div className="analytics-chart-values">
          {data.map((d) => (
            <div key={d.name}>
              <strong>{d.name}</strong>
              <span>
                {unit === "INR" ? inr(d.value) : d.value + " " + unit}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
