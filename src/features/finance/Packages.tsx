import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Badge } from "../../components";
import { DEMO_DATE, type RecordItem } from "../../data";
import {
  OperationForm,
  DetailList,
  Metrics,
  Empty,
  options,
} from "../operations/OperationsUI";
import { FinanceHeader, FinanceError, useFinanceSave } from "./FinanceUI";
import { savePackage } from "./services";
import {
  packageState,
  invoicePaid,
  invoiceBalance,
  inr,
  accountCredit,
} from "./ledger";
export function PatientPackageBalances({
  patientId,
  courseId,
}: {
  patientId?: string;
  courseId?: string;
}) {
  const { state } = useFinanceSave();
  const courses = state.records["Treatment Plans"].filter(
    (r) =>
      r.course &&
      (!patientId || r.patientId === patientId) &&
      (!courseId || r.id === courseId),
  );
  return (
    <div className="finance-package-grid">
      {courses.map((r) => {
        const invoices = state.records["Packages & Billing"].filter(
            (i) => i.courseId === r.id,
          ),
          paid = invoices.reduce((n, i) => n + invoicePaid(state, i.id), 0),
          balance = invoices.reduce((n, i) => n + invoiceBalance(state, i), 0);
        return (
          <article className="card operations-room" key={r.id}>
            <div className="operations-split">
              <div>
                <Link className="text-link" to={"/patients/" + r.patientId}>
                  {state.patients.find((p) => p.id === r.patientId)?.name}
                </Link>
                <h3>
                  {r.course?.treatmentName} · {r.course?.area}
                </h3>
              </div>
              <Badge>{packageState(r)}</Badge>
            </div>
            <div className="finance-session-balance">
              <div>
                <small>Purchased</small>
                <strong>{r.totalSittings || 0}</strong>
              </div>
              <div>
                <small>Consumed</small>
                <strong>{r.completedSittings || 0}</strong>
              </div>
              <div>
                <small>Remaining</small>
                <strong>
                  {Math.max(
                    0,
                    (r.totalSittings || 0) - (r.completedSittings || 0),
                  )}
                </strong>
              </div>
            </div>
            <DetailList
              items={[
                ["Package price", inr(r.course!.packagePrice)],
                ["Net applied payments", inr(paid)],
                ["Outstanding issued invoices", inr(balance)],
                ["Expiry", r.course?.validUntil],
                [
                  "Payment status",
                  !invoices.some((i) => i.invoice?.state === "Issued")
                    ? "No issued invoice"
                    : balance > 0
                      ? "Payment pending"
                      : "Paid",
                ],
                [
                  "Unallocated patient credit",
                  inr(accountCredit(state, r.patientId!)),
                ],
              ]}
            />
            <small>
              Only qualifying session completion consumes a sitting. Expired or
              exhausted packages cannot provide new sittings.
            </small>
            <div className="operations-actions">
              <Link className="button" to={"/treatment-plans/courses/" + r.id}>
                Open course
              </Link>
              {r.course?.invoiceId && (
                <Link className="button" to={"/invoices/" + r.course.invoiceId}>
                  Open invoice
                </Link>
              )}
            </div>
          </article>
        );
      })}
      {!courses.length && (
        <Empty>No treatment packages are linked to this patient.</Empty>
      )}
    </div>
  );
}
function PackageEditor({
  record,
  onClose,
}: {
  record?: RecordItem;
  onClose: () => void;
}) {
  const { state, save, error } = useFinanceSave(),
    d = record?.packageConfig;
  return (
    <OperationForm
      title={record ? "Edit package" : "Create package"}
      fields={[
        { key: "name", label: "Package name", required: true },
        {
          key: "treatmentId",
          label: "Treatment",
          required: true,
          options: [
            { value: "", label: "Select treatment" },
            ...state.records["Treatment Catalogue"].map((t) => ({
              value: t.id,
              label: t.name,
            })),
          ],
        },
        {
          key: "area",
          label: "Treatment area",
          required: true,
          help: "Use Any clinician-approved area for an area-independent offer.",
        },
        {
          key: "sessions",
          label: "Included sessions",
          type: "number",
          required: true,
        },
        {
          key: "price",
          label: "Package list price (INR)",
          type: "number",
          required: true,
        },
        {
          key: "discount",
          label: "Package discount (INR)",
          type: "number",
          required: true,
        },
        {
          key: "validityDays",
          label: "Validity (days from purchase)",
          type: "number",
          required: true,
        },
        {
          key: "status",
          label: "Catalogue status",
          options: options(["Active", "Inactive"]),
        },
        {
          key: "terms",
          label: "Package terms",
          type: "textarea",
          required: true,
        },
      ]}
      initial={{
        name: record?.name || "",
        treatmentId: d?.treatmentId || "",
        area: d?.area || "Any clinician-approved area",
        sessions: String(d?.sessions || 1),
        price: String(d?.price || 0),
        discount: String(d?.discount || 0),
        validityDays: String(d?.validityDays || state.adminSettings?.defaultPackageDays || 180),
        status: record?.status || "Active",
        terms: d?.terms || "",
      }}
      onClose={onClose}
      onSave={(v) =>
        save(
          (s) =>
            savePackage(s, {
              ...record,
              id: record?.id || "package-" + crypto.randomUUID(),
              name: v.name,
              status: v.status,
              detail: v.terms,
              amount: Number(v.price) - Number(v.discount),
              packageConfig: {
                treatmentId: v.treatmentId,
                area: v.area,
                sessions: Number(v.sessions),
                price: Number(v.price),
                discount: Number(v.discount),
                validityDays: Number(v.validityDays),
                terms: v.terms,
              },
            }),
          "Package configuration saved",
        )
      }
    >
      <FinanceError error={error} />
      <p className="finance-caption">
        Prices and terms are configurable offers. Editing a catalogue entry
        never changes an existing purchase or a clinician-approved session
        count.
      </p>
    </OperationForm>
  );
}
export default function Packages() {
  const { packageId } = useParams(),
    { state } = useFinanceSave(),
    [q, setQ] = useState(""),
    [status, setStatus] = useState("All"),
    [view, setView] = useState<"catalogue" | "balances">("catalogue"),
    [edit, setEdit] = useState<RecordItem | null | undefined>();
  const record = state.records["Package Catalogue"].find(
      (r) => r.id === packageId,
    ),
    courses = state.records["Treatment Plans"].filter((r) => r.course),
    rows = state.records["Package Catalogue"].filter(
      (r) =>
        (r.name + " " + r.packageConfig?.area)
          .toLowerCase()
          .includes(q.toLowerCase()) &&
        (status === "All" || r.status === status),
    );
  return (
    <div className="finance-page">
      <FinanceHeader
        title={packageId ? record?.name || "Package not found" : "Packages"}
        description="Configurable clinic offers and patient purchases, linked to approved courses."
        actions={
          <button
            className="button primary"
            onClick={() => setEdit(record || null)}
          >
            {record ? "Edit package" : "+ Create package"}
          </button>
        }
      />
      {record?.packageConfig ? (
        <section className="card operations-room">
          <Link className="text-link" to="/packages">
            ← Package catalogue
          </Link>
          <h2>{record.name}</h2>
          <Badge>{record.status}</Badge>
          <DetailList
            items={[
              [
                "Treatment",
                state.records["Treatment Catalogue"].find(
                  (t) => t.id === record.packageConfig!.treatmentId,
                )?.name,
              ],
              ["Area", record.packageConfig.area],
              ["Included sessions", record.packageConfig.sessions],
              ["List price", inr(record.packageConfig.price)],
              ["Discount", inr(record.packageConfig.discount)],
              [
                "Net package price",
                inr(record.packageConfig.price - record.packageConfig.discount),
              ],
              [
                "Validity",
                record.packageConfig.validityDays + " days from purchase",
              ],
              ["Terms", record.packageConfig.terms],
              [
                "Payment status",
                "Tracked per patient purchase below; catalogue entries are not payments",
              ],
            ]}
          />
          <Link
            className="button primary"
            to="/treatment-plans?status=Approved"
          >
            Choose with an approved plan
          </Link>
          <h3>Purchases using this offer</h3>
          {courses
            .filter((c) => c.course?.packageTemplateId === record.id)
            .map((c) => (
              <Link
                className="operations-mini-row"
                key={c.id}
                to={"/treatment-plans/courses/" + c.id}
              >
                <span>
                  {state.patients.find((p) => p.id === c.patientId)?.name}
                </span>
                <Badge>{packageState(c)}</Badge>
              </Link>
            ))}
          {!courses.some((c) => c.course?.packageTemplateId === record.id) && (
            <Empty>No patient purchases of this catalogue offer yet.</Empty>
          )}
        </section>
      ) : packageId ? (
        <Empty>No package exists at this address.</Empty>
      ) : (
        <>
          <Metrics
            items={[
              ["Catalogue offers", state.records["Package Catalogue"].length],
              [
                "Active patient packages",
                courses.filter((c) => packageState(c) === "Active").length,
              ],
              [
                "Expiring within 14 days",
                courses.filter((c) => packageState(c) === "Expiring").length,
              ],
              [
                "Exhausted / expired",
                courses.filter((c) =>
                  ["Exhausted", "Expired"].includes(packageState(c)),
                ).length,
              ],
            ]}
          />
          <nav className="operations-tabs" aria-label="Package views">
            <button
              aria-pressed={view === "catalogue"}
              className={view === "catalogue" ? "active" : ""}
              onClick={() => {
                setView("catalogue");
                setStatus("All");
              }}
            >
              Package catalogue
            </button>
            <button
              aria-pressed={view === "balances"}
              className={view === "balances" ? "active" : ""}
              onClick={() => {
                setView("balances");
                setStatus("All");
              }}
            >
              Patient package balances
            </button>
          </nav>
          <div className="operations-filters card">
            <label>
              Search
              <input
                aria-label="Search packages"
                placeholder="Package, patient or area"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </label>
            <label>
              Status
              <select
                aria-label="Package status filter"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {(view === "catalogue"
                  ? ["All", "Active", "Inactive"]
                  : [
                      "All",
                      "Active",
                      "Expiring",
                      "Exhausted",
                      "Expired",
                      "Paused",
                      "Cancelled",
                    ]
                ).map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <button
              className="button"
              onClick={() => {
                setQ("");
                setStatus("All");
              }}
            >
              Reset
            </button>
          </div>
          {view === "catalogue" ? (
            <section className="card">
              {rows.map((r) => (
                <div className="finance-package-row" key={r.id}>
                  <div>
                    <Link className="text-link" to={"/packages/" + r.id}>
                      {r.name}
                    </Link>
                    <small>
                      {
                        state.records["Treatment Catalogue"].find(
                          (t) => t.id === r.packageConfig!.treatmentId,
                        )?.name
                      }{" "}
                      · {r.packageConfig?.area}
                    </small>
                    <small>
                      {r.packageConfig?.sessions} sessions ·{" "}
                      {r.packageConfig?.validityDays} days
                    </small>
                  </div>
                  <div>
                    <Badge>{r.status}</Badge>
                    <small>Payment tracked per patient purchase</small>
                  </div>
                  <div className="finance-number">
                    <strong>
                      {inr(r.packageConfig!.price - r.packageConfig!.discount)}
                    </strong>
                    <small>Discount {inr(r.packageConfig!.discount)}</small>
                  </div>
                  <div className="operations-actions">
                    <Link className="button" to={"/packages/" + r.id}>
                      Details
                    </Link>
                    <button className="button" onClick={() => setEdit(r)}>
                      Edit
                    </button>
                  </div>
                </div>
              ))}
              {!rows.length && (
                <Empty>No package offers match the filters.</Empty>
              )}
            </section>
          ) : (
            <div className="finance-purchase-filter">
              {courses
                .filter(
                  (c) =>
                    (
                      c.name +
                      " " +
                      c.course?.treatmentName +
                      " " +
                      c.course?.area
                    )
                      .toLowerCase()
                      .includes(q.toLowerCase()) &&
                    (status === "All" || packageState(c) === status),
                )
                .map((c) => (
                  <PatientPackageBalances key={c.id} courseId={c.id} />
                ))}
              {!courses.some(
                (c) =>
                  (
                    c.name +
                    " " +
                    c.course?.treatmentName +
                    " " +
                    c.course?.area
                  )
                    .toLowerCase()
                    .includes(q.toLowerCase()) &&
                  (status === "All" || packageState(c) === status),
              ) && (
                <Empty>
                  No patient packages match. Statuses use {DEMO_DATE}.
                </Empty>
              )}
            </div>
          )}
        </>
      )}
      {edit !== undefined && (
        <PackageEditor
          record={edit || undefined}
          onClose={() => setEdit(undefined)}
        />
      )}
    </div>
  );
}
