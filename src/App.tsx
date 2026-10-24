import { quickContext, moduleForPath } from "./features/admin/access";
import { useState, lazy, Suspense } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
  useSearchParams,
} from "react-router-dom";
import { ClinicProvider, useClinic } from "./store";
import { modules, slug, DEMO_DATE, type Patient } from "./data";
import {
  readSession,
  saveSession,
  visibleModules,
  type DemoSession,
  type Role,
} from "./auth";
import Shell from "./layouts/Shell";
import Login from "./pages/Login";
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Patients = lazy(() => import("./pages/Patients"));
const PatientProfile = lazy(() => import("./pages/PatientProfile"));
const Followups = lazy(() => import("./features/scheduling/Followups"));
const Appointments = lazy(() => import("./pages/Appointments"));
const RecordsPage = lazy(() => import("./pages/RecordsPage"));
const Settings = lazy(() => import("./pages/Settings"));
const Reports = lazy(() => import("./pages/Reports"));
import QuickCreate, { type CreateKind } from "./features/QuickCreate";

import "./styles.css";
import "./tokens.css";
import "./workspace.css";
import "./patients.css";
import "./skin-analysis.css";
import "./clinical.css";
import "./sessions.css";
import "./scheduling.css";
import "./operations.css";
import "./finance.css";
import "./crm-analytics.css";
import "./admin.css";
import "./components.css";
const Staff = lazy(() => import("./features/admin/Staff"));
const Integrations = lazy(() => import("./features/admin/Integrations"));
const Leads = lazy(() => import("./features/crm/Leads"));
const Billing = lazy(() => import("./features/finance/Billing"));
const Packages = lazy(() => import("./features/finance/Packages"));
const Payments = lazy(() => import("./features/finance/Payments"));
const InvoiceForm = lazy(() => import("./features/finance/InvoiceForm"));
const InvoiceDetail = lazy(() => import("./features/finance/InvoiceDetail"));
const Machines = lazy(() => import("./features/operations/Machines"));
const MachineDetail = lazy(() => import("./features/operations/MachineDetail"));
const Maintenance = lazy(() => import("./features/operations/Maintenance"));
const Inventory = lazy(() => import("./features/operations/Inventory"));
const Rooms = lazy(() => import("./features/operations/Rooms"));
const Consultations = lazy(() => import("./features/clinical/Consultations"));
const TreatmentCatalogue = lazy(
  () => import("./features/clinical/TreatmentCatalogue"),
);
const TreatmentPlans = lazy(() => import("./features/clinical/TreatmentPlans"));
const CourseDetail = lazy(() => import("./features/clinical/CourseDetail"));
const ScanLibrary = lazy(() => import("./features/scans/ScanLibrary"));
const ScanReport = lazy(() => import("./features/scans/ScanReport"));
const DoctorReview = lazy(() => import("./features/scans/DoctorReview"));
const ScanComparison = lazy(() => import("./features/scans/ScanComparison"));
const NewScanPage = lazy(() => import("./features/scans/NewScanPage"));
const Sessions = lazy(() => import("./features/sessions/Sessions"));
const SessionWorkspace = lazy(
  () => import("./features/sessions/SessionWorkspace"),
);
function Workspace({
  session,
  onRole,
  onLogout,
}: {
  session: DemoSession;
  onRole: (role: Role) => void;
  onLogout: () => void;
}) {
  const [create, setCreate] = useState<CreateKind | null>(null);
  const navigate = useNavigate();
  const [createCourseId, setCreateCourseId] = useState("");
  const [createPatientId, setCreatePatientId] = useState("");
  const [createInvoiceId, setCreateInvoiceId] = useState("");
  const location = useLocation();
  const [params] = useSearchParams();
  const { state: clinic } = useClinic();
  const allowed = visibleModules(session.role);
  const onPatient = (p: Patient) => {
    navigate("/patients/" + encodeURIComponent(p.id), {
      state: {
        directory:
          location.pathname === "/patients"
            ? location.search
            : location.state?.directory || "",
      },
    });
  };
  const onCourse = (id: string) => navigate("/treatment-plans/courses/" + id);
  const onCreate = (kind: CreateKind, id?: string, courseId?: string) => {
    const context = quickContext(clinic, location.pathname, location.search);
    setCreateCourseId(
      courseId || (kind !== "patient" ? context.courseId : "") || "",
    );
    setCreatePatientId(
      id || (kind !== "patient" ? context.patientId : "") || "",
    );
    setCreateInvoiceId(kind === "payment" ? context.invoiceId || "" : "");
    setCreate(kind);
  };
  const role = session.role;
  const common = { role, onPatient, onCourse, onCreate };
  return (
    <Shell
      session={session}
      onRole={onRole}
      onLogout={onLogout}
      onCreate={onCreate}
      onPatient={onPatient}
    >
      <Suspense
        fallback={
          <div
            className="workspace-loading"
            role="status"
            aria-label="Loading workspace"
          >
            <div />
            <div />
            <div />
            <p>Preparing your clinic workspace…</p>
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Navigate to="/dashboard" replace />} />
          <Route
            path="/patients/:patientId"
            element={
              <PatientProfile
                key={location.pathname}
                role={session.role}
                onCreate={onCreate}
                onCourse={onCourse}
              />
            }
          />
          <Route
            path="/skin-analysis/new"
            element={<NewScanPage role={role} />}
          />
          <Route
            path="/skin-analysis/compare"
            element={<ScanComparison role={role} />}
          />
          <Route
            path="/skin-analysis/:scanId/edit"
            element={<NewScanPage role={role} />}
          />
          <Route
            path="/skin-analysis/:scanId/review"
            element={<DoctorReview role={role} onCourse={onCourse} />}
          />
          <Route
            path="/skin-analysis/:scanId"
            element={<ScanReport role={role} onCourse={onCourse} />}
          />
          <Route
            path="/consultations/:consultationId"
            element={
              <Consultations
                key={location.pathname + location.search}
                role={role}
              />
            }
          />
          <Route
            path="/treatment-plans/courses/:courseId"
            element={
              <CourseDetail
                key={location.pathname}
                role={role}
                onCreate={onCreate}
              />
            }
          />
          <Route
            path="/treatment-plans/:planId"
            element={
              <TreatmentPlans
                key={location.pathname + location.search}
                role={role}
              />
            }
          />
          <Route
            path="/machines-equipment/:machineId"
            element={<MachineDetail />}
          />
          <Route path="/packages" element={<Packages />} />
          <Route path="/packages/:packageId" element={<Packages />} />
          <Route path="/invoices" element={<Billing invoicesOnly />} />
          <Route path="/invoices/new" element={<InvoiceForm key="new" />} />
          <Route
            path="/invoices/:invoiceId/edit"
            element={<InvoiceForm key={location.pathname} />}
          />
          <Route
            path="/invoices/:invoiceId"
            element={<InvoiceDetail key={location.pathname} />}
          />
          {modules.map((page) => {
            const visible = !allowed || allowed.includes(page);
            let element;
            if (!visible)
              element = (
                <section className="card access-demo">
                  <h1>This view belongs to another demo role.</h1>
                  <p>
                    Choose Clinic Owner in the role selector to explore all
                    clinic modules. Demo roles customize the interface only.
                  </p>
                </section>
              );
            else if (page === "Dashboard")
              element = (
                <Dashboard
                  session={session}
                  onCreate={onCreate}
                  onPatient={onPatient}
                  onCourse={onCourse}
                />
              );
            else if (page === "Patients")
              element = (
                <Patients
                  role={role}
                  onPatient={onPatient}
                  onCreate={() => onCreate("patient")}
                  onBook={(p) => onCreate("appointment", p.id)}
                />
              );
            else if (page === "Appointments")
              element = (
                <Appointments
                  role={role}
                  onPatient={onPatient}
                  onCourse={onCourse}
                  onCreate={() => onCreate("appointment")}
                />
              );
            else if (page === "Follow-ups") element = <Followups role={role} />;
            else if (page === "Consultations")
              element = <Consultations role={role} />;
            else if (page === "Treatment Catalogue")
              element = <TreatmentCatalogue role={role} />;
            else if (page === "Treatment Plans")
              element = <TreatmentPlans role={role} />;
            else if (page === "Skin Analysis")
              element = <ScanLibrary role={role} onCourse={onCourse} />;
            else if (page === "Machines & Equipment") element = <Machines />;
            else if (page === "Maintenance") element = <Maintenance />;
            else if (page === "Inventory") element = <Inventory />;
            else if (page === "Rooms & Resources") element = <Rooms />;
            else if (page === "Packages & Billing") element = <Billing />;
            else if (page === "Payments") element = <Payments />;
            else if (page === "Staff & Roles") element = <Staff />;
            else if (page === "Integrations") element = <Integrations />;
            else if (page === "Clinic Settings") element = <Settings />;
            else if (page === "Leads & Enquiries") element = <Leads />;
            else if (page === "Reports & Analytics") element = <Reports />;
            else if (page === "Sittings & Sessions")
              element = (
                <Sessions role={role} onCreate={() => onCreate("session")} />
              );
            else element = <RecordsPage key={page} page={page} {...common} />;
            return (
              <Route key={page} path={"/" + slug(page)} element={element} />
            );
          })}
          <Route
            path="/sittings-sessions/:sessionId"
            element={<SessionWorkspace role={role} />}
          />
          <Route
            path="*"
            element={
              <section className="card access-demo">
                <h1>Page not found</h1>
                <p>This clinic view doesn’t exist.</p>
                <a className="button primary" href="/dashboard">
                  Back to Dashboard
                </a>
              </section>
            }
          />
        </Routes>
      </Suspense>
      {create && (
        <QuickCreate
          kind={create}
          key={`${create}-${createPatientId}-${location.pathname}`}
          initialPatientId={createPatientId}
          initialCourseId={createCourseId}
          initialInvoiceId={createInvoiceId}
          onSavedClinical={(r, kind) => {
            if (!createPatientId)
              navigate(
                (kind === "plan" ? "/treatment-plans/" : "/consultations/") +
                  r.id,
              );
          }}
          onOpenSession={(r) => navigate("/sittings-sessions/" + r.id)}
          onSavedPatient={onPatient}
          onSavedScan={(r, review) =>
            navigate("/skin-analysis/" + r.id + (review ? "/review" : ""))
          }
          onExisting={onPatient}
          date={params.get("date") || DEMO_DATE}
          onClose={() => {
            setCreate(null);
            setCreatePatientId("");
          }}
        />
      )}{" "}
    </Shell>
  );
}
function Entry() {
  const location = useLocation();
  const [session, setSession] = useState(() =>
    location.pathname === "/" || location.pathname === "/login"
      ? null
      : readSession(),
  );
  const navigate = useNavigate();
  const { notify } = useClinic();
  function enter(value: DemoSession) {
    setSession(value);
    navigate("/dashboard", { replace: true });
    notify(`Welcome to your ${value.role.toLowerCase()} demo`);
  }
  function roleChange(role: Role) {
    if (!session) return;
    const next = {
      ...session,
      role,
      name:
        role === "Receptionist"
          ? "Riya Malhotra"
          : role === "Laser Technician"
            ? "Aarav Singh"
            : "Dr. Mehta",
    };
    saveSession(next, !!localStorage.getItem("mmverse-session"));
    setSession(next);
    const visible = visibleModules(role);
    const current = moduleForPath(location.pathname);
    if (current && visible && !visible.includes(current))
      navigate("/dashboard");
    notify(`Demo role switched to ${role}`);
  }
  function logout() {
    localStorage.removeItem("mmverse-session");
    sessionStorage.removeItem("mmverse-session");
    setSession(null);
    navigate("/login", { replace: true });
  }
  if (!session)
    return location.pathname === "/login" ? (
      <Login onEnter={enter} />
    ) : (
      <Navigate to="/login" replace />
    );
  return <Workspace session={session} onRole={roleChange} onLogout={logout} />;
}
export default function App() {
  return (
    <BrowserRouter>
      <ClinicProvider>
        <Entry />
      </ClinicProvider>
    </BrowserRouter>
  );
}
