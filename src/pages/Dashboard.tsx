import { financeSummary } from "../features/finance/ledger";
import { expiringCourses } from "../features/finance/packageSelectors";
import { chartColors } from '../designSystem';
import { machineStatus } from "../features/operations/selectors";
import { visibleModules } from "../auth";
import { safeDate } from "../services";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  CalendarDays,
  Activity,
  Users,
  Clock,
  UserRoundX,
  ClipboardList,
  Wallet,
  CreditCard,
  ArrowUpRight,
  Plus,
  ChevronLeft,
  ChevronRight,
  Sun,
  Monitor,
  ShieldCheck,
} from "lucide-react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { useClinic } from "../store";
import { DEMO_DATE, money, slug, type Patient } from "../data";
import { dayLabel, addDays, dashboardStats, followupStatus } from "../services";
import { canBook, canBill, type DemoSession } from "../auth";
import { Badge, SectionTitle } from "../components";
import TreatmentQueue from "../features/TreatmentQueue";
import { type CreateKind } from "../features/QuickCreate";
interface Props {
  session: DemoSession;
  onCreate: (kind: CreateKind) => void;
  onPatient: (p: Patient) => void;
  onCourse: (id: string) => void;
}
export default function Dashboard({
  session,
  onCreate,
  onPatient,
  onCourse,
}: Props) {
  const { state } = useClinic();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const date = safeDate(params.get("date"));
  const [range, setRange] = useState("7");
  const stats = dashboardStats(state, date);
  const go = (m: string, query: Record<string, string> = {}) =>
    navigate(`/${slug(m)}?${new URLSearchParams({ date, ...query })}`);
  const changeDate = (value: string) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) setParams({ date: value });
  };
  const kpis: {
    title: string;
    value: string | number;
    Icon: typeof CalendarDays;
    note: string;
    module: string;
    query: Record<string, string>;
  }[] = [
    {
      title: "Appointments today",
      value: stats.appointments,
      Icon: CalendarDays,
      note: "Your day, thoughtfully planned",
      module: "Appointments",
      query: { excludeCancelled: "true" },
    },
    {
      title: "Laser sittings today",
      value: stats.laser,
      Icon: Activity,
      note: "Connected to the treatment queue",
      module: "Sittings & Sessions",
      query: { source: "queue", treatment: "laser", excludeCancelled: "true" },
    },
    {
      title: "Checked-in patients",
      value: stats.checkedIn,
      Icon: Users,
      note: "Ready for their next step",
      module: "Appointments",
      query: { status: "Checked in" },
    },
    {
      title: "Follow-ups due",
      value: stats.followups,
      Icon: Clock,
      note: "A timely check-in matters",
      module: "Follow-ups",
      query: { status: "Due today" },
    },
    {
      title: "Overdue patients",
      value: stats.overdue,
      Icon: UserRoundX,
      note: "Bring their care back on track",
      module: "Follow-ups",
      query: { status: "Overdue" },
    },
    {
      title: "Active treatment courses",
      value: stats.courses,
      Icon: ClipboardList,
      note: "Care journeys in progress",
      module: "Treatment Plans",
      query: { status: "Active" },
    },
    {
      title: "Collections today",
      value: money(stats.collections),
      Icon: Wallet,
      note: "Recorded demo payments · INR",
      module: "Payments",
      query: { status: "Received" },
    },
    {
      title: "Outstanding payments",
      value: money(stats.outstanding),
      Icon: CreditCard,
      note: "Across unpaid clinic invoices",
      module: "Packages & Billing",
      query: { status: "Pending" },
    },
  ];
  const upcoming = state.appointments
    .filter(
      (a) => a.date >= date && ["Confirmed", "Checked in"].includes(a.status),
    )
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .slice(0, 4);
  const due = state.records["Follow-ups"].filter(
    (r) => followupStatus(r, date) === "Due today",
  );
  const overdue = state.records["Follow-ups"].filter(
    (r) => followupStatus(r, date) === "Overdue",
  );
  const expiryDays = state.adminSettings?.notifications.expiryDays || 14;
  const packages = expiringCourses(state, date, expiryDays);
  const revenue = Array.from({ length: Number(range) }, (_, i) => {
    const day = addDays(date, i - Number(range) + 1);
    return {
      date: day,
      label: new Date(`${day}T12:00:00Z`).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        timeZone: "Asia/Kolkata",
      }),
      amount: financeSummary(state, day, day).collections,
    };
  });
  const totalRevenue = revenue.reduce((n, r) => n + r.amount, 0);
  const visits = state.appointments.filter(
    (a) => a.date === date && a.status !== "Cancelled",
  );
  const distribution = Object.entries(
    visits.reduce<Record<string, number>>(
      (acc, a) => ({ ...acc, [a.treatment]: (acc[a.treatment] || 0) + 1 }),
      {},
    ),
  ).map(([name, value]) => ({
    name: name
      .replace(" hair reduction", "")
      .replace(" hair restoration", "")
      .replace(" management", ""),
    fullName: name,
    value,
  }));
  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <Sun size={14} /> YOUR CLINIC, CONNECTED
          </div>
          <h1>Good morning, {session.name}.</h1>
          <p>A clear view of your day. More space to focus on care.</p>
        </div>
        <div className="heading-actions">
          <span className="environment-label">
            <ShieldCheck size={13} /> Demo workspace
          </span>
          {canBook(session.role) && (
            <button
              className="button primary"
              onClick={() => onCreate("appointment")}
            >
              <Plus size={16} />
              Book appointment
            </button>
          )}
          {session.role === "Laser Technician" && (
            <button
              className="button primary"
              onClick={() => onCreate("session")}
            >
              <Plus size={16} />
              Prepare session
            </button>
          )}
        </div>
      </div>
      <div className="overview-line dashboard-controls">
        <div>
          <span className="live-dot" />
          <strong>{state.clinicName}</strong>
          <small>Indiranagar · Asia/Kolkata</small>
        </div>
        <div className="date-control">
          <button
            className="icon"
            aria-label="Previous day"
            onClick={() => changeDate(addDays(date, -1))}
          >
            <ChevronLeft size={15} />
          </button>
          <label>
            <CalendarDays size={15} />
            <span className="sr-only">Dashboard date</span>
            <input
              aria-label="Dashboard date"
              type="date"
              value={date}
              onChange={(e) => changeDate(e.target.value)}
            />
          </label>
          <button
            className="icon"
            aria-label="Next day"
            onClick={() => changeDate(addDays(date, 1))}
          >
            <ChevronRight size={15} />
          </button>
          {date !== DEMO_DATE && (
            <button
              className="text-button"
              onClick={() => changeDate(DEMO_DATE)}
            >
              Demo today
            </button>
          )}
        </div>
      </div>
      <div className="metrics dashboard-metrics">
        {kpis
          .filter(
            (k) =>
              canBill(session.role) ||
              !["Payments", "Packages & Billing"].includes(k.module),
          )
          .filter(
            (k) =>
              !visibleModules(session.role) ||
              visibleModules(session.role)!.includes(k.module),
          )
          .map((k, i) => (
            <button
              className="metric"
              key={k.title}
              onClick={() => go(k.module, k.query)}
            >
              <div className="metric-top">
                {k.title}
                <span className={`metric-icon tone-${i % 4}`}>
                  <k.Icon size={17} />
                </span>
              </div>
              <strong className="metric-value">{k.value}</strong>
              <div className="metric-foot">
                {k.note}
                <ArrowUpRight size={13} />
              </div>
            </button>
          ))}
      </div>
      <TreatmentQueue
        key={date}
        date={date}
        role={session.role}
        onPatient={onPatient}
        onCourse={onCourse}
      />
      <div className="dashboard-chart-grid">
        {canBill(session.role) && (
          <section className="card revenue">
            <div className="section-title">
              <h3>Revenue trend</h3>
              <select
                aria-label="Revenue date range"
                value={range}
                onChange={(e) => setRange(e.target.value)}
              >
                <option value="7">Last 7 days</option>
                <option value="14">Last 14 days</option>
              </select>
            </div>
            <div className="chart-top">
              <div>
                <strong>{money(totalRevenue)}</strong>
                <span className="revenue-caption">
                  Recorded collections ·{" "}
                  {dayLabel(addDays(date, 1 - Number(range)))} –{" "}
                  {dayLabel(date)}
                </span>
              </div>
              <span className="chart-unit">INR</span>
            </div>
            <div className="chart">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={revenue}
                  margin={{ top: 10, right: 12, left: -10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="revenue-sage"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="var(--color-primary)"
                        stopOpacity={0.25}
                      />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 4"
                    vertical={false}
                    stroke="#e9ede8"
                  />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "var(--color-muted)" }}
                    minTickGap={20}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(n) => `${n / 1000}k`}
                    tick={{ fontSize: 11, fill: "var(--color-muted)" }}
                  />
                  <Tooltip formatter={(v) => money(Number(v))} />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    name="Collections"
                    stroke="var(--color-primary)"
                    strokeWidth={2.5}
                    isAnimationActive={false}
                    fill="url(#revenue-sage)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-footer">
              <span>
                <i className="dot" /> Demo collections from shared records
              </span>
              <button className="text-button" onClick={() => go("Payments")}>
                View payments <ArrowUpRight size={12} />
              </button>
            </div>
          </section>
        )}
        <section className="card distribution-card">
          <SectionTitle
            title="Treatment distribution"
            action="View queue"
            onClick={() =>
              document
                .querySelector(".queue-card")
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
          />
          <p className="small-text muted">
            {visits.length} visits · {dayLabel(date)}
          </p>
          {distribution.length ? (
            <div className="distribution-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={distribution}
                  layout="vertical"
                  margin={{ top: 4, right: 25, left: 5, bottom: 0 }}
                >
                  <XAxis type="number" hide allowDecimals={false} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={105}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "var(--color-muted)" }}
                  />
                  <Tooltip
                    formatter={(v) => [v, "Visits"]}
                    labelFormatter={(_, payload) =>
                      payload[0]?.payload.fullName || ""
                    }
                  />
                  <Bar
                    dataKey="value"
                    radius={[0, 4, 4, 0]}
                    maxBarSize={17}
                    label={{ position: "right", fontSize: 11, fill: "var(--color-muted)" }}
                  >
                    {distribution.map((d, i) => (
                      <Cell
                        key={d.name}
                        fill={chartColors[i % chartColors.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="empty">No treatments scheduled for this date.</div>
          )}
          <div className="chart-footer">
            <span>Based on scheduled, active and completed visits</span>
          </div>
        </section>
      </div>
      <div className="dashboard-detail-grid">
        <section className="card detail-card">
          <SectionTitle
            title="Upcoming appointments"
            action="View schedule"
            onClick={() => go("Appointments")}
          />
          {upcoming.map((a) => {
            const p = state.patients.find((p) => p.id === a.patientId);
            return (
              <button
                className="mini-row"
                key={a.id}
                onClick={() => p && onPatient(p)}
              >
                <span className="mini-time">
                  {a.time}
                  <small>
                    {a.date === date ? "Today" : dayLabel(a.date).slice(0, 6)}
                  </small>
                </span>
                <span className="mini-copy">
                  <strong>{p?.name}</strong>
                  <small>{a.treatment}</small>
                </span>
                <Badge>{a.status}</Badge>
              </button>
            );
          })}
          {!upcoming.length && <div className="empty">No upcoming visits.</div>}
        </section>
        <section className="card detail-card">
          <SectionTitle
            title="Follow-ups due"
            action="View all"
            onClick={() => go("Follow-ups", { status: "Due today" })}
          />
          {due.map((r) => (
            <button
              className="mini-row"
              key={r.id}
              onClick={() =>
                go("Follow-ups", { status: "Due today", record: r.id })
              }
            >
              <span className="round-symbol amber-bg">
                <Clock size={17} />
              </span>
              <span className="mini-copy">
                <strong>{r.name}</strong>
                <small>{r.detail}</small>
              </span>
              <ArrowUpRight size={14} />
            </button>
          ))}
          {!due.length && (
            <div className="empty">No follow-ups due. Care is on track.</div>
          )}
          <div className="detail-subheading">
            <span className="danger-dot" />
            Overdue patients <b>{overdue.length}</b>
          </div>
          {overdue.map((r) => (
            <button
              className="mini-row"
              key={r.id}
              onClick={() =>
                go("Follow-ups", { status: "Overdue", record: r.id })
              }
            >
              <span className="round-symbol rose-bg">
                <UserRoundX size={17} />
              </span>
              <span className="mini-copy">
                <strong>{r.name}</strong>
                <small>Due {dayLabel(r.dueDate || DEMO_DATE)}</small>
              </span>
              <ArrowUpRight size={14} />
            </button>
          ))}
          {!overdue.length && (
            <p className="inline-empty">No overdue follow-ups.</p>
          )}
        </section>
        <section className="card detail-card">
          <SectionTitle
            title="Machine availability"
            action="Equipment"
            onClick={() => go("Machines & Equipment")}
          />
          {state.records["Machines & Equipment"].map((m) => {
            const status = machineStatus(state, m, date);
            return (
              <button
                className="mini-row"
                key={m.id}
                onClick={() => go("Machines & Equipment", { record: m.id })}
              >
                <span className="round-symbol sage-bg">
                  <Monitor size={17} />
                </span>
                <span className="mini-copy">
                  <strong>{m.name}</strong>
                  <small>Simulated · {m.detail.split(" · ")[0]}</small>
                </span>
                <Badge>{status}</Badge>
              </button>
            );
          })}
          <div className="machine-caption">
            <ShieldCheck size={13} />
            Availability is simulated, not a device connection.
          </div>
        </section>
        {canBill(session.role) && (
          <section className="card detail-card">
            <SectionTitle
              title="Expiring packages"
              action="View packages"
              onClick={() => navigate("/packages")}
            />
            {packages.map((r) => (
              <button
                className="mini-row"
                key={r.id}
                onClick={() => onCourse(r.id)}
              >
                <span className="round-symbol amber-bg">
                  <ClipboardList size={17} />
                </span>
                <span className="mini-copy">
                  <strong>
                    {state.patients.find((p) => p.id === r.patientId)?.name ||
                      r.name}
                  </strong>
                  <small>
                    {r.course?.treatmentName} · expires {dayLabel(r.course!.validUntil)}
                  </small>
                </span>
                <ArrowUpRight size={14} />
              </button>
            ))}
            {!packages.length && (
              <div className="empty">
                No packages with remaining sittings expire in the next {expiryDays} days.
              </div>
            )}
          </section>
        )}
        <section className="card detail-card recent-activity">
          <SectionTitle title="Recent activity" />
          <div className="activity-list">
            {state.activity
              .filter(
                (a) =>
                  new Intl.DateTimeFormat("en-CA", {
                    timeZone: "Asia/Kolkata",
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                  }).format(new Date(a.at)) === date,
              )
              .slice(0, 5)
              .map((a) => (
                <div className="activity-row" key={a.id}>
                  <span className="live-dot" />
                  <div>
                    <p>{a.message}</p>
                    <small>
                      {new Intl.DateTimeFormat("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "Asia/Kolkata",
                      }).format(new Date(a.at))}{" "}
                      IST
                    </small>
                  </div>
                </div>
              ))}
            {!state.activity.some(
              (a) =>
                new Date(a.at).toLocaleDateString("en-CA", {
                  timeZone: "Asia/Kolkata",
                }) === date,
            ) && (
              <div className="empty">No activity recorded on this date.</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
