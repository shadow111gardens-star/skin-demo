import { useEffect, useRef, useState } from "react";
import { Modal } from "../../components";
import { useClinic } from "../../store";
import type { Role } from "../../auth";
import { quickActions, type CreateKind } from "../QuickCreate";
import {
  globalSearch,
  clinicNotifications,
  notificationAction,
  type SearchResult,
} from "./globalSelectors";
import { notificationCategories } from "./model";
export function SearchPanel({
  query,
  setQuery,
  role,
  onClose,
  onSelect,
}: {
  query: string;
  setQuery: (value: string) => void;
  role: Role;
  onClose: () => void;
  onSelect: (result: SearchResult) => void;
}) {
  const { state } = useClinic(),
    input = useRef<HTMLInputElement>(null),
    results = globalSearch(state, query, role);
  useEffect(() => {
    input.current?.focus();
  }, []);
  return (
    <Modal
      title="Search workspace"
      className="global-panel global-search-panel"
      onClose={onClose}
    >
      <div className="global-search-entry">
        <input
          ref={input}
          aria-label="Search patients or modules"
          placeholder="Patient, ID, mobile, course, appointment or machine"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results.length) {
              e.preventDefault();
              onSelect(results[0]);
            }
          }}
        />
        <button
          className="button"
          disabled={!query}
          onClick={() => {
            setQuery("");
            input.current?.focus();
          }}
        >
          Clear search
        </button>
      </div>
      <p className="admin-note">
        Ctrl / ⌘ K opens search. Select a result or press Enter for the first
        match.
      </p>
      <p className="sr-only" role="status">
        {results.length} results
      </p>
      {!query.trim() && (
        <p className="global-empty">
          Search patients, patient IDs, mobile numbers, treatment courses,
          appointments and machines. Suggested modules are below.
        </p>
      )}
      {(
        [
          "Patients",
          "Treatment courses",
          "Appointments",
          "Machines",
          "Modules",
        ] as const
      ).map((group) => {
        const all = results.filter((r) => r.group === group);
        return all.length ? (
          <section className="global-result-group" key={group}>
            <h3>
              {group} <span>{all.length}</span>
            </h3>
            {all.slice(0, 8).map((r) => (
              <button
                className="global-result"
                key={r.group + r.id}
                onClick={() => onSelect(r)}
              >
                <span>
                  <strong>{r.label}</strong>
                  <small>{r.detail}</small>
                </span>
                <span>↗</span>
              </button>
            ))}
            {all.length > 8 && (
              <small className="admin-note">
                Showing 8 matches; narrow your search for more precise results.
              </small>
            )}
          </section>
        ) : null;
      })}
      {query.trim() && !results.length && (
        <div className="global-empty">
          No matching records. Try another name, ID, mobile number or machine
          serial.
        </div>
      )}
    </Modal>
  );
}
export function NotificationPanel({
  role,
  onClose,
  onNavigate,
}: {
  role: Role;
  onClose: () => void;
  onNavigate: (href: string) => void;
}) {
  const { state, setState, notify } = useClinic(),
    [category, setCategory] = useState(""),
    [unreadOnly, setUnreadOnly] = useState(false),
    all = clinicNotifications(state, role),
    active = all.filter((n) => !n.dismissed),
    rows = active.filter(
      (n) => (!category || n.category === category) && (!unreadOnly || !n.read),
    );
  function act(action: Parameters<typeof notificationAction>[1], id?: string) {
    setState((s) =>
      notificationAction(s, action, clinicNotifications(s, role), id),
    );
  }
  return (
    <Modal
      title="Clinic notifications"
      className="global-panel global-notification-panel"
      onClose={onClose}
    >
      <div className="global-notification-controls">
        <label>
          Category
          <select
            aria-label="Notification category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All categories</option>
            {notificationCategories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="admin-checkbox">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => setUnreadOnly(e.target.checked)}
          />
          Unread only
        </label>
        <button
          className="button"
          disabled={!active.some((n) => !n.read)}
          onClick={() => {
            act("read-all");
            notify("Visible clinic alerts marked as read");
          }}
        >
          Mark all as read
        </button>
        {all.some((n) => n.dismissed) && (
          <button className="button" onClick={() => act("restore")}>
            Restore dismissed alerts
          </button>
        )}
      </div>
      <p className="admin-note">
        Alerts are derived from current demo records. Read/dismiss state is
        local; a changed source record can surface a fresh alert.
      </p>
      {notificationCategories
        .filter((c) => !category || category === c)
        .map((c) => {
          const group = rows.filter((n) => n.category === c);
          return group.length ? (
            <section className="global-notification-group" key={c}>
              <h3>
                {c} <span>{group.length}</span>
              </h3>
              {group.map((n) => (
                <article
                  key={n.id}
                  className={
                    "global-notification " + (n.read ? "read" : "unread")
                  }
                >
                  <button
                    className="global-notification-link"
                    onClick={() => {
                      act("read", n.id);
                      onNavigate(n.href);
                    }}
                  >
                    <span className="global-unread-dot" />
                    <span>
                      <strong id={"notification-title-" + n.id}>
                        {n.title}
                      </strong>
                      <small>{n.detail}</small>
                    </span>
                    <span>↗</span>
                  </button>
                  <div className="global-notification-actions">
                    <button
                      className="button"
                      aria-describedby={"notification-title-" + n.id}
                      aria-label={
                        n.read ? "Mark notification unread" : "Mark notification read"
                      }
                      onClick={() => act(n.read ? "unread" : "read", n.id)}
                    >
                      {n.read ? "Mark unread" : "Mark read"}
                    </button>
                    <button
                      className="button"
                      aria-label="Dismiss notification"
                      aria-describedby={"notification-title-" + n.id}
                      onClick={() => act("dismiss", n.id)}
                    >
                      Dismiss
                    </button>
                  </div>
                </article>
              ))}
            </section>
          ) : null;
        })}
      {!rows.length && (
        <div className="global-empty">
          No alerts match these preferences and filters. You’re all caught up.
        </div>
      )}
    </Modal>
  );
}
const labels: Record<CreateKind, string> = {
  patient: "Register Patient",
  appointment: "Book Appointment",
  scan: "Add Skin Scan",
  plan: "Create Treatment Plan",
  session: "Record Sitting",
  followup: "Schedule Follow-up",
  payment: "Record Payment",
  consultation: "Start Consultation",
};
export function QuickCreatePanel({
  role,
  context,
  onClose,
  onCreate,
}: {
  role: Role;
  context: string;
  onClose: () => void;
  onCreate: (kind: CreateKind) => void;
}) {
  return (
    <Modal
      title="Quick create"
      className="global-panel global-create-panel"
      onClose={onClose}
    >
      <p className="admin-note">
        {context
          ? "Patient context: " +
            context +
            ". Available forms use this existing patient where relevant."
          : "Choose a workflow. Select an existing patient in the form to keep records connected."}
      </p>
      {quickActions(role).map((q) => (
        <button
          className="global-quick-action"
          key={q.kind}
          aria-label={labels[q.kind] + " · " + q.label + " " + q.detail}
          onClick={() => onCreate(q.kind)}
        >
          <span className="global-quick-plus">+</span>
          <span>
            <strong>{labels[q.kind]}</strong>
            <small>{q.detail}</small>
          </span>
          <span>↗</span>
        </button>
      ))}
      <p className="admin-note">
        Availability follows the simulated demo role. No production
        authentication or real payment/message processing is provided.
      </p>
    </Modal>
  );
}
