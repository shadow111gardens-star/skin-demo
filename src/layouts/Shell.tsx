import {
  SearchPanel,
  NotificationPanel,
  QuickCreatePanel,
} from "../features/admin/GlobalPanels";
import { clinicNotifications } from "../features/admin/globalSelectors";
import { quickContext } from "../features/admin/access";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  LayoutDashboard,
  Users,
  ScanFace,
  Stethoscope,
  Sparkles,
  ClipboardList,
  CalendarDays,
  Clock,
  Files,
  Monitor,
  CircleHelp,
  Settings,
  Package,
  CreditCard,
  Wallet,
  UserRoundPlus,
  ChartNoAxesCombined,
  ShieldCheck,
  Plug,
  Search,
  Bell,
  Plus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  Menu,
  X,
  CheckCircle2,
  AlertCircle,
  Wrench,
  LogOut,
} from "lucide-react";
import { modules, slug, type Patient } from "../data";
import { roles, visibleModules, type DemoSession, type Role } from "../auth";
import { useClinic } from "../store";
import { Avatar, Modal } from "../components";
import { type CreateKind } from "../features/QuickCreate";
const icons = [
  LayoutDashboard,
  Users,
  ScanFace,
  Stethoscope,
  Sparkles,
  ClipboardList,
  Activity,
  CalendarDays,
  Clock,
  Files,
  Monitor,
  Wrench,
  Package,
  Monitor,
  CreditCard,
  Wallet,
  UserRoundPlus,
  ChartNoAxesCombined,
  ShieldCheck,
  Settings,
  Plug,
];
interface Props {
  children: ReactNode;
  session: DemoSession;
  onRole: (role: Role) => void;
  onLogout: () => void;
  onCreate: (kind: CreateKind) => void;
  onPatient: (p: Patient) => void;
}
export default function Shell({
  children,
  session,
  onRole,
  onLogout,
  onCreate,
  onPatient,
}: Props) {
  const { state, toast, toastType, clearToast } = useClinic();
  const location = useLocation();
  const context = quickContext(state, location.pathname, location.search);
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() =>
    localStorage.getItem("mmverse-collapsed") !== null
      ? localStorage.getItem("mmverse-collapsed") === "true"
      : window.innerWidth >= 768 && window.innerWidth <= 1000,
  );
  const [mobile, setMobile] = useState(false);
  const [panel, setPanel] = useState("");
  const [query, setQuery] = useState("");
  const [help, setHelp] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const allowed = visibleModules(session.role);
  const visible = modules.filter((m) => !allowed || allowed.includes(m));
  const page =
    modules.find(
      (m) =>
        location.pathname === "/" + slug(m) ||
        location.pathname.startsWith("/" + slug(m) + "/"),
    ) ||
    (/^\/(packages|invoices)(\/|$)/.test(location.pathname)
      ? "Packages & Billing"
      : "Dashboard");
  useLayoutEffect(() => {
    setPanel("");
    setMobile(false);
  }, [location.pathname, session.role]);
  useEffect(
    () => localStorage.setItem("mmverse-collapsed", String(collapsed)),
    [collapsed],
  );
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPanel("search");
      }
      if (e.key === "Escape") {
        setPanel("");
        setMobile(false);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
  const go = (module: string) => {
    navigate("/" + slug(module));
    setPanel("");
    setMobile(false);
  };
  const notices = clinicNotifications(state, session.role).filter(
    (n) => !n.dismissed,
  );
  const unreadNotices = notices.filter((n) => !n.read).length;
  return (
    <div
      className={`app ${collapsed ? "collapsed" : ""} ${mobile ? "mobile-navigation-open" : ""}`}
    >
      {mobile && (
        <button
          className="mobile-scrim"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <aside
        className={`sidebar ${mobile ? "mobile-open" : ""}`}
        aria-label="Main navigation"
      >
        <div className="brand">
          <span className="brand-mark">
            <Activity size={24} />
          </span>
          <span className="brand-word">
            MMVerse<small>SKIN & LASER CLINIC OS</small>
          </span>
          <button
            className="mobile-close icon"
            onClick={() => setMobile(false)}
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        </div>
        <button
          className="clinic-switch"
          onClick={() => setPanel(panel === "clinic" ? "" : "clinic")}
          title={state.clinicName}
        >
          <span className="clinic-logo">a.</span>
          <span className="clinic-info">
            <strong>{state.clinicName}</strong>
            <small>{state.adminSettings?.profile.address || "Indiranagar, Bengaluru"}</small>
          </span>
          <ChevronDown size={14} />
        </button>
        <div className="nav-scroll">
          {[
            { title: "WORKSPACE", names: ["Dashboard"] },
            { title: "CLINICAL", names: modules.slice(1, 10) },
            { title: "EQUIPMENT", names: modules.slice(10, 14) },
            { title: "BUSINESS", names: modules.slice(14, 18) },
            { title: "ADMINISTRATION", names: modules.slice(18) },
          ].map((group) => {
            const names = group.names.filter((m) => visible.includes(m));
            return names.length ? (
              <div key={group.title}>
                <div className="nav-label">{group.title}</div>
                {names.map((m) => {
                  const Icon = icons[modules.indexOf(m)];
                  return (
                    <NavLink
                      key={m}
                      title={m}
                      aria-label={m}
                      to={"/" + slug(m)}
                      className={({ isActive }) =>
                        `nav-item ${isActive || (m === "Packages & Billing" && page === "Packages & Billing") ? "active" : ""}`
                      }
                    >
                      <Icon size={17} />
                      <span className="nav-text">{m}</span>
                      {m === "Follow-ups" && (
                        <b className="nav-count">
                          {
                            state.records["Follow-ups"].filter(
                              (r) => r.status !== "Completed",
                            ).length
                          }
                        </b>
                      )}
                      <span className="nav-tooltip">{m}</span>
                    </NavLink>
                  );
                })}
              </div>
            ) : null;
          })}
        </div>
        <div className="sidebar-foot">
          <div className="help-card">
            <CircleHelp size={19} />
            <span>
              <strong>A little help, anytime.</strong>
              <small>Your clinic, running smoothly.</small>
            </span>
            <button onClick={() => setHelp(true)} aria-label="Open help">
              <ArrowUpRight size={16} />
            </button>
          </div>
          <button
            className="collapse-button"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <ChevronLeft size={16} />
            <span>Collapse sidebar</span>
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon mobile-menu"
            onClick={() => setMobile(true)}
            aria-label="Open navigation"
          >
            <Menu size={21} />
          </button>
          <div className="breadcrumb">
            <button
              className="top-clinic-display"
              onClick={() => setPanel(panel === "clinic" ? "" : "clinic")}
              title={state.clinicName}
            >
              <span className="desktop-clinic-label">{state.clinicName}</span>
              <span className="mobile-clinic-label">Clinic</span>
            </button>
            <ChevronRight size={13} />
            <strong>{page}</strong>
          </div>
          <div className="top-actions">
            <div className="global-search">
              <Search size={16} />
              <input
                ref={searchRef}
                aria-label="Search workspace"
                placeholder="Search anything…"
                value={query}
                onFocus={() => setPanel("search")}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPanel("search");
                }}
              />
              <kbd>⌘ K</kbd>
            </div>
            <button
              className="icon mobile-search"
              aria-label="Search workspace"
              onClick={() => setPanel(panel === "search" ? "" : "search")}
            >
              <Search size={18} />
            </button>
            <span className="top-divider" />
            <button
              className="icon notification"
              aria-label="Notifications"
              onClick={() =>
                setPanel(panel === "notifications" ? "" : "notifications")
              }
            >
              <Bell size={19} />
              {unreadNotices > 0 && (
                <i aria-label={unreadNotices + " unread clinic alerts"} />
              )}
            </button>
            <button
              className="quick-button"
              aria-label="Quick create"
              onClick={() => setPanel(panel === "create" ? "" : "create")}
            >
              <Plus size={16} />
              <span>Quick create</span>
            </button>
            <label className="top-role">
              <span className="sr-only">Demo role</span>
              <select
                aria-label="Demo role"
                value={session.role}
                onChange={(e) => onRole(e.target.value as Role)}
              >
                {roles.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            <button
              className="profile"
              aria-label="Profile menu"
              onClick={() => setPanel(panel === "profile" ? "" : "profile")}
            >
              <Avatar small name={session.name} />
              <ChevronDown size={13} />
            </button>
          </div>
        </header>
        {panel === "search" && (
          <SearchPanel
            query={query}
            setQuery={setQuery}
            role={session.role}
            onClose={() => setPanel("")}
            onSelect={(r) => {
              if (r.group === "Patients") {
                const p = state.patients.find((p) => p.id === r.patientId);
                if (p) onPatient(p);
                else navigate(r.href);
              } else navigate(r.href);
              setPanel("");
            }}
          />
        )}
        {panel === "notifications" && (
          <NotificationPanel
            role={session.role}
            onClose={() => setPanel("")}
            onNavigate={(href) => {
              navigate(href);
              setPanel("");
            }}
          />
        )}
        {panel === "create" && (
          <QuickCreatePanel
            role={session.role}
            context={context.label}
            onClose={() => setPanel("")}
            onCreate={(kind) => {
              onCreate(kind);
              setPanel("");
            }}
          />
        )}
        {panel && !["search", "notifications", "create"].includes(panel) && (
          <>
            <div className="panel-dismiss" onClick={() => setPanel("")} />
            <section
              className={`popover panel-${panel}`}
              aria-label={
                panel === "search" ? "Global search" : `${panel} panel`
              }
            >
              <header>
                <h4>
                  {panel === "search"
                    ? "Search workspace"
                    : panel === "notifications"
                      ? "Clinic notifications"
                      : panel === "create"
                        ? "Quick create"
                        : panel === "clinic"
                          ? "Your clinic"
                          : "Your demo profile"}
                </h4>
                <button
                  className="icon"
                  aria-label="Close panel"
                  onClick={() => setPanel("")}
                >
                  <X size={15} />
                </button>
              </header>
              {panel === "clinic" ? (
                <>
                  <div className="clinic-panel-info">
                    <span className="clinic-logo">a.</span>
                    <div>
                      <strong>{state.clinicName}</strong>
                      <p>
                        {state.adminSettings?.profile.address ||
                          "Indiranagar, Bengaluru"}
                      </p>
                      <small>Asia/Kolkata · INR · Demo clinic</small>
                    </div>
                  </div>
                  {session.role === "Clinic Owner" && (
                    <button onClick={() => go("Clinic Settings")}>
                      <Settings size={16} />
                      Manage clinic settings
                    </button>
                  )}
                  <p className="popover-empty">
                    You’re viewing your main demo clinic.
                  </p>
                </>
              ) : (
                <>
                  <div className="profile-info">
                    <Avatar name={session.name} />
                    <div>
                      <strong>{session.name}</strong>
                      <small>{session.email}</small>
                    </div>
                  </div>
                  <label className="profile-role-label">
                    Explore as
                    <select
                      aria-label="Profile demo role"
                      value={session.role}
                      onChange={(e) => onRole(e.target.value as Role)}
                    >
                      {roles.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </label>
                  <p className="role-explainer">
                    Demo roles customize this interface. They do not provide
                    production access control.
                  </p>
                  <button
                    onClick={() => {
                      setPanel("");
                      onLogout();
                    }}
                  >
                    <LogOut size={16} />
                    Exit demo / sign out
                  </button>
                </>
              )}
            </section>
          </>
        )}
        <main id="main-content" tabIndex={-1}>
          {children}
          <footer className="main-footer">
            <span>
              <span className="live-dot" /> Fictional demo records · saved in
              this browser
            </span>
            <span>
              Intelligent care. Connected journeys. <b>MMVerse</b>
            </span>
          </footer>
        </main>
      </div>
      <nav className="bottom-nav" aria-label="Mobile navigation">
        {[
          { module: "Dashboard", label: "Home", Icon: LayoutDashboard },
          { module: "Patients", label: "Patients", Icon: Users },
          { module: "Appointments", label: "Schedule", Icon: CalendarDays },
          { module: "Follow-ups", label: "Follow-ups", Icon: Clock },
        ].map(({ module, label, Icon }) => (
          <button
            key={module}
            className={page === module ? "active" : ""}
            onClick={() => go(module)}
          >
            <Icon size={19} />
            <span>{label}</span>
          </button>
        ))}
        <button
          className={mobile ? "active" : ""}
          onClick={() => {
            setCollapsed(false);
            setMobile(true);
          }}
        >
          <Menu size={19} />
          <span>More</span>
        </button>
      </nav>
      {help && (
        <Modal title="A little help, anytime" onClose={() => setHelp(false)}>
          <p>
            Use Quick create to add patients, appointments and care records.
            Dashboard cards open filtered modules. Select a patient to review
            their connected journey.
          </p>
          <div className="info-strip">
            This demo stores fictional data in your browser. Connections, scans
            and payments are simulated.
          </div>
        </Modal>
      )}
      {toast && (
        <div
          className={`toast ${toastType}`}
          role={toastType === "error" ? "alert" : "status"}
        >
          {toastType === "error" ? (
            <AlertCircle size={18} />
          ) : (
            <CheckCircle2 size={18} />
          )}
          {toast}
          <button
            className="icon"
            onClick={clearToast}
            aria-label="Dismiss notification"
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
