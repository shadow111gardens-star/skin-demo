import { useState, type FormEvent } from "react";
import {
  Activity,
  ArrowRight,
  Eye,
  EyeOff,
  ShieldCheck,
  CalendarDays,
  Users,
  Check,
  Leaf,
} from "lucide-react";
import { roles, saveSession, type Role, type DemoSession } from "../auth";
export default function Login({
  onEnter,
}: {
  onEnter: (session: DemoSession) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [role, setRole] = useState<Role>(() => {
    const saved = localStorage.getItem("mmverse-role");
    return roles.includes(saved as Role) ? (saved as Role) : "Clinic Owner";
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  function enter(demo: boolean) {
    if (
      !demo &&
      (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 6)
    ) {
      setError(
        "Enter a valid email and a password with at least 6 characters.",
      );
      return;
    }
    setError("");
    setBusy(true);
    const session: DemoSession = {
      role,
      email: demo ? "demo@mmverse.clinic" : email,
      name:
        role === "Doctor"
          ? "Dr. Mehta"
          : role === "Receptionist"
            ? "Riya Malhotra"
            : role === "Laser Technician"
              ? "Aarav Singh"
              : "Dr. Mehta",
    };
    saveSession(session, remember);
    onEnter(session);
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    enter(false);
  }
  return (
    <div className="login-page">
      <aside className="login-story">
        <a className="login-brand" href="/login">
          <span className="brand-mark">
            <Activity size={25} />
          </span>
          <span>
            MMVerse<small>SKIN & LASER CLINIC OS</small>
          </span>
        </a>
        <div className="story-content">
          <div className="story-tag">
            <Leaf size={14} /> A calmer way to run your clinic
          </div>
          <h1>
            Every detail connected.
            <br />
            Every patient cared for.
          </h1>
          <p>
            One thoughtful workspace for your people, treatments and the
            journeys that bring them together.
          </p>
          <div className="story-preview">
            <div className="preview-title">
              <span className="live-dot" /> YOUR CLINIC, AT A GLANCE{" "}
              <span>Today</span>
            </div>
            <div className="preview-numbers">
              <div>
                <CalendarDays size={19} />
                <strong>24</strong>
                <small>appointments</small>
              </div>
              <div>
                <Users size={19} />
                <strong>08</strong>
                <small>patients in care</small>
              </div>
              <div>
                <Check size={19} />
                <strong>12</strong>
                <small>sessions completed</small>
              </div>
            </div>
            <div className="preview-care">
              <span className="avatar">AS</span>
              <span>
                <strong>Ananya’s next chapter</strong>
                <small>Laser course · sitting 4 of 6</small>
              </span>
              <span className="preview-badge">Ready for care</span>
            </div>
            <small className="preview-caption">
              Illustrative clinic snapshot
            </small>
          </div>
          <div className="story-values">
            <span>
              <Check size={14} /> Connected patient journeys
            </span>
            <span>
              <Check size={14} /> Clearer clinic operations
            </span>
          </div>
        </div>
        <footer>
          Intelligent care. Connected journeys.
          <span>Designed around your day.</span>
        </footer>
      </aside>
      <main className="login-main">
        <span className="demo-pill">
          <span className="live-dot" /> INTERACTIVE DEMO
        </span>
        <div className="login-form-wrap">
          <div className="login-welcome">WELCOME TO MMVERSE</div>
          <h2>A better day starts here.</h2>
          <p className="login-subtitle">
            Step into your clinic’s connected workspace.
          </p>
          <form onSubmit={submit} noValidate>
            <label htmlFor="email">
              Work email
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@clinic.com"
                aria-invalid={!!error}
                required
              />
            </label>
            <label htmlFor="password">
              Password
              <div className="password-field">
                <input
                  id="password"
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  className="icon"
                  aria-label={show ? "Hide password" : "Show password"}
                  onClick={() => setShow(!show)}
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            <label htmlFor="demo-role">
              Explore as
              <select
                id="demo-role"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                {roles.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            <label className="checkbox remember">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />{" "}
              Remember me on this browser
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="button primary login-submit" disabled={busy}>
              {busy ? "Opening workspace…" : "Simulate sign in"}
              <ArrowRight size={17} />
            </button>
            <div className="or-divider">
              <span />
              or explore without credentials
              <span />
            </div>
            <button
              type="button"
              className="button secondary login-submit"
              disabled={busy}
              onClick={() => enter(true)}
            >
              Enter Demo
              <ArrowRight size={17} />
            </button>
          </form>
          <div className="login-safety">
            <ShieldCheck size={19} />
            <p>
              Fictional patients. Real possibilities.
              <br />
              <span>
                Sign-in is simulated. Roles change the demo interface only; this
                is not production authentication. Passwords are never saved or
                sent.
              </span>
            </p>
          </div>
        </div>
        <footer>
          MMVerse · Skin & Laser Clinic OS <span>Demo environment</span>
        </footer>
      </main>
    </div>
  );
}
