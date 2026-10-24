import { clinicDoctors, clinicTechnicians } from "../features/admin/access";
﻿import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Search,
} from "lucide-react";
import { useClinic } from "../store";
import { DEMO_DATE, type Patient, type Appointment } from "../data";
import { safeDate, addDays, dayLabel } from "../services";
import { canBook, type Role } from "../auth";
import { Badge } from "../components";
import { appointmentStatuses } from "../features/scheduling/model";
import AppointmentForm from "../features/scheduling/AppointmentForm";
import AppointmentDrawer from "../features/scheduling/AppointmentDrawer";
function weekStart(date: string) {
  const d = new Date(date + "T12:00:00Z");
  return addDays(date, -((d.getUTCDay() + 6) % 7));
}
function monthStep(date: string, n: number) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}
export default function Appointments({
  role,
}: {
  role: Role;
  onPatient: (p: Patient) => void;
  onCourse: (id: string) => void;
  onCreate: () => void;
  sessions?: boolean;
}) {
  const { state } = useClinic(),
    [params, setParams] = useSearchParams(),
    [create, setCreate] = useState(false),
    [source, setSource] = useState("Clinic desk");
  const date = safeDate(params.get("date")),
    view = params.get("view") || "Day",
    selected = params.get("appointment") || params.get("record") || "",
    q = params.get("q") || "";
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart(date), i)),
    month = Array.from({ length: 42 }, (_, i) =>
      addDays(weekStart(date.slice(0, 8) + "01"), i),
    );
  const change = (key: string, value: string) => {
    const n = new URLSearchParams(params);
    if (value === "All" || !value) n.delete(key);
    else n.set(key, value);
    setParams(n, { replace: true });
  };
  const rows = state.appointments
    .filter(
      (a) =>
        (!params.get("patientId") || a.patientId === params.get("patientId")) &&
        (!params.get("status") ||
          params.get("status") === "All" ||
          a.status === params.get("status")) &&
        (!params.get("doctor") || a.doctor === params.get("doctor")) &&
        (!params.get("technician") ||
          a.technician === params.get("technician")) &&
        (!params.get("room") || a.room === params.get("room")) &&
        (!params.get("machine") || a.machineId === params.get("machine")) &&
        (!params.get("excludeCancelled") || a.status !== "Cancelled") &&
        (!params.get("treatment") ||
          (params.get("treatment") === "laser"
            ? a.treatment.toLowerCase().includes("laser")
            : a.treatment === params.get("treatment"))) &&
        `${state.patients.find((p) => p.id === a.patientId)?.name} ${a.patientId} ${a.treatment} ${a.id}`
          .toLowerCase()
          .includes(q.toLowerCase()),
    )
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const daily = rows.filter((a) => a.date === date),
    range =
      view === "Month"
        ? rows.filter((a) => month.includes(a.date))
        : view === "Week"
          ? rows.filter((a) => week.includes(a.date))
          : view === "Agenda"
            ? rows.filter((a) => a.date >= date && a.date < addDays(date, 14))
            : daily;
  function move(n: number) {
    change(
      "date",
      view === "Month"
        ? monthStep(date, n)
        : addDays(date, n * (view === "Week" ? 7 : 1)),
    );
  }
  function openDay(d: string) {
    const next = new URLSearchParams(params);
    next.set("date", d);
    next.set("view", "Day");
    setParams(next);
  }
  function card(a: Appointment, compact = false) {
    const p = state.patients.find((p) => p.id === a.patientId);
    return (
      <button
        className={
          "calendar-event " +
          (compact ? "compact " : "") +
          "event-" +
          a.status.toLowerCase().replaceAll(" ", "-")
        }
        key={a.id}
        onClick={() => change("appointment", a.id)}
        aria-label={`${a.time} ${p?.name} ${a.treatment} ${a.status}`}
      >
        <span className="event-time">
          {a.time} <small>{a.duration || 45} min</small>
        </span>
        <strong>{p?.name}</strong>
        <span>
          {a.treatment}{" "}
          {a.courseId ? "· " + a.sitting + "/" + a.totalSittings : ""}
        </span>
        <small>
          {a.doctor} · {a.technician || "Unassigned"} · {a.room || "No room"}
        </small>
        <Badge>{a.status}</Badge>
      </button>
    );
  }
  const agenda = (visits: Appointment[]) =>
    visits.length ? (
      visits.map((a) => (
        <article className="calendar-agenda-row" key={a.id}>
          <time>
            {a.date}
            <strong>{a.time}</strong>
          </time>
          {card(a)}
        </article>
      ))
    ) : (
      <div className="empty">
        <CalendarDays size={25} />
        <h3>No appointments match this view</h3>
        <p>Try another date or reset filters.</p>
        <button className="text-button" onClick={() => setParams({ date })}>
          Reset filters
        </button>
      </div>
    );
  return (
    <div className="calendar-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR CLINIC SCHEDULE</div>
          <h1>Appointments</h1>
          <p>One connected schedule for your patients and care team.</p>
        </div>
        {canBook(role) && (
          <div className="heading-actions">
            <button
              className="button secondary"
              onClick={() => {
                setSource("Walk-in");
                setCreate(true);
              }}
            >
              Add walk-in
            </button>
            <button
              className="button primary"
              onClick={() => {
                setSource("Clinic desk");
                setCreate(true);
              }}
            >
              <Plus size={15} />
              Book appointment
            </button>
          </div>
        )}
      </div>
      <div className="calendar-overview">
        <span>
          <strong>
            {range.filter((a) => a.status !== "Cancelled").length}
          </strong>{" "}
          visits in view
        </span>
        <span>
          <strong>
            {range.filter((a) => a.status === "Checked in").length}
          </strong>{" "}
          checked in
        </span>
        <span>
          <strong>
            {
              state.appointments.filter((a) => a.status === "Waiting list")
                .length
            }
          </strong>{" "}
          waiting for allocation
        </span>
        <small>Demo operating day {DEMO_DATE} · Asia/Kolkata</small>
      </div>
      <section className="card calendar-card">
        <div className="calendar-toolbar">
          <div className="calendar-date-controls">
            <button
              className="icon"
              aria-label="Previous calendar period"
              onClick={() => move(-1)}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              className="icon"
              aria-label="Next calendar period"
              onClick={() => move(1)}
            >
              <ChevronRight size={18} />
            </button>
            <button
              className="button secondary"
              onClick={() => change("date", DEMO_DATE)}
            >
              Today
            </button>
            <label>
              Schedule date
              <input
                aria-label="Schedule date"
                type="date"
                value={date}
                onChange={(e) => change("date", e.target.value)}
              />
            </label>
          </div>
          <nav className="calendar-view-controls" aria-label="Calendar view">
            {["Day", "Week", "Month", "Agenda"].map((v) => (
              <button
                aria-pressed={view === v}
                key={v}
                onClick={() => change("view", v)}
              >
                {v}
              </button>
            ))}
          </nav>
        </div>
        <div className="calendar-filter-bar">
          <div className="search-field">
            <Search size={15} />
            <input
              aria-label="Search appointments"
              value={q}
              onChange={(e) => change("q", e.target.value)}
              placeholder="Patient, treatment or ID…"
            />
          </div>
          {[
            ["doctor", "Doctor", [...new Set([...clinicDoctors(state), ...state.appointments.map(a => a.doctor)])]],
            [
              "technician",
              "Technician",
              [...new Set([...clinicTechnicians(state), ...state.appointments.map(a => a.technician || "")])].filter((t) => t && t !== "Not assigned"),
            ],
            [
              "room",
              "Room",
              [
                ...new Set(
                  state.records["Rooms & Resources"].map((r) => r.room!.code),
                ),
              ],
            ],
            [
              "machine",
              "Machine",
              state.records["Machines & Equipment"].map((m) => m.id),
            ],
            ["status", "Status", appointmentStatuses],
          ].map(([key, label, values]) => (
            <select
              aria-label={"Filter " + label}
              key={key as string}
              value={params.get(key as string) || "All"}
              onChange={(e) => change(key as string, e.target.value)}
            >
              <option value="All">
                {key === "status"
                  ? "All statuses"
                  : "All " + String(label).toLowerCase() + "s"}
              </option>
              {(values as string[]).map((v) => (
                <option key={v} value={v}>
                  {key === "machine"
                    ? state.records["Machines & Equipment"].find(
                        (m) => m.id === v,
                      )?.name
                    : v}
                </option>
              ))}
            </select>
          ))}
          <button
            className="text-button"
            onClick={() => setParams({ date, view })}
          >
            Reset filters
          </button>
        </div>
        <div className="calendar-period-label">
          <strong>
            {view === "Month"
              ? new Intl.DateTimeFormat("en-IN", {
                  month: "long",
                  year: "numeric",
                  timeZone: "Asia/Kolkata",
                }).format(new Date(date + "T12:00:00+05:30"))
              : view === "Week"
                ? dayLabel(week[0]) + " – " + dayLabel(week[6])
                : dayLabel(date)}
          </strong>
          <span>{range.length} appointments · IST</span>
        </div>
        <div className="calendar-mobile-date-strip">
          {week.map((d) => (
            <button
              key={d}
              aria-current={d === date ? "date" : undefined}
              onClick={() => change("date", d)}
            >
              <small>
                {new Date(d + "T12:00:00Z").toLocaleDateString("en-IN", {
                  weekday: "short",
                  timeZone: "UTC",
                })}
              </small>
              <strong>{d.slice(-2)}</strong>
            </button>
          ))}
        </div>
        <div className="calendar-desktop-view">
          {view === "Month" ? (
            <div className="calendar-month-grid">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div className="weekday" key={d}>
                  {d}
                </div>
              ))}
              {month.map((d) => (
                <div
                  className={
                    "month-cell " +
                    (d.slice(0, 7) !== date.slice(0, 7) ? "outside" : "")
                  }
                  key={d}
                >
                  <button
                    className="month-day-button"
                    onClick={() => openDay(d)}
                    aria-label={"Open " + d}
                  >
                    {d.slice(-2)}
                  </button>
                  {rows
                    .filter((a) => a.date === d)
                    .slice(0, 3)
                    .map((a) => card(a, true))}
                  {rows.filter((a) => a.date === d).length > 3 && (
                    <button className="text-button" onClick={() => openDay(d)}>
                      +{rows.filter((a) => a.date === d).length - 3} more
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : view === "Week" ? (
            <div className="calendar-week-grid">
              {week.map((d) => (
                <section key={d}>
                  <button
                    className="week-day-heading"
                    onClick={() => openDay(d)}
                  >
                    {new Date(d + "T12:00:00Z").toLocaleDateString("en-IN", {
                      weekday: "short",
                      day: "numeric",
                      timeZone: "UTC",
                    })}
                  </button>
                  {rows.filter((a) => a.date === d).map((a) => card(a, true))}
                  {!rows.some((a) => a.date === d) && (
                    <p className="calendar-no-slots">No visits</p>
                  )}
                </section>
              ))}
            </div>
          ) : (
            <div className="calendar-agenda">{agenda(range)}</div>
          )}
        </div>
        <div className="calendar-mobile-agenda">
          <p className="mobile-agenda-label">Day agenda ? {dayLabel(date)}</p>
          {agenda(daily)}
        </div>
        <footer className="calendar-legend">
          <span>● Scheduled</span>
          <span>● Checked in / active</span>
          <span>● Completed</span>
          <span>○ Cancelled / no-show</span>
          <span>Waiting list reserves no resources</span>
        </footer>
      </section>
      {create && (
        <AppointmentForm
          key={source}
          initialPatientId={params.get("patientId") || ""}
          date={date}
          source={source}
          onClose={() => setCreate(false)}
        />
      )}
      {selected && (
        <AppointmentDrawer
          key={selected}
          id={selected}
          role={role}
          onClose={() => {
            const n = new URLSearchParams(params);
            n.delete("record");
            n.delete("appointment");
            setParams(n, { replace: true });
          }}
        />
      )}
    </div>
  );
}
