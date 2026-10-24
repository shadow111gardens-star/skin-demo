import { X, CalendarDays, ArrowUpRight, ClipboardList } from "lucide-react";
import { Avatar, Badge, useDialogFocus } from "../components";
import { type Patient, money } from "../data";
import { useClinic } from "../store";
import { canBook, type Role } from "../auth";
import { dayLabel } from "../services";
export function PatientDrawer({
  patient,
  onClose,
  onBook,
  onCourse,
  role,
}: {
  patient: Patient;
  onClose: () => void;
  onBook: () => void;
  onCourse: (id: string) => void;
  role: Role;
}) {
  const ref = useDialogFocus(onClose);
  const { state } = useClinic();
  const courses = state.records["Treatment Plans"].filter(
    (r) => r.patientId === patient.id,
  );
  return (
    <div className="overlay drawer-overlay" onMouseDown={onClose}>
      <section
        ref={ref}
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Patient profile"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header>
          <span>Patient profile</span>
          <button
            className="icon"
            onClick={onClose}
            aria-label="Close patient profile"
          >
            <X size={20} />
          </button>
        </header>
        <Avatar name={patient.name} />
        <h2>{patient.name}</h2>
        <p className="muted">
          {patient.id} · {patient.age} years · {patient.phone}
        </p>
        <Badge>{patient.status}</Badge>
        <h3>Care journeys</h3>
        {courses.map((r) => (
          <button
            className="course-link"
            key={r.id}
            onClick={() => onCourse(r.id)}
          >
            <ClipboardList size={18} />
            <span>
              <strong>{r.detail}</strong>
              <small>{r.id}</small>
            </span>
            <ArrowUpRight size={15} />
          </button>
        ))}
        {!courses.length && (
          <div className="journey">
            <span className="live-dot" />
            <div>
              <strong>{patient.treatment}</strong>
              <p>No active course recorded yet.</p>
            </div>
          </div>
        )}
        <h3>Appointments</h3>
        {state.appointments
          .filter((a) => a.patientId === patient.id)
          .map((a) => (
            <div className="profile-appointment" key={a.id}>
              <div>
                <strong>
                  {dayLabel(a.date)} · {a.time}
                </strong>
                <small>{a.treatment}</small>
              </div>
              <Badge>{a.status}</Badge>
            </div>
          ))}
        <h3>Care follow-ups</h3>
        {state.records["Follow-ups"]
          .filter((r) => r.patientId === patient.id)
          .map((r) => (
            <div className="profile-appointment" key={r.id}>
              <span>{r.detail}</span>
              <Badge>{r.status}</Badge>
            </div>
          ))}
        <div className="info-strip">
          Fictional demo record. Treatment decisions require clinician review.
        </div>
        {canBook(role) && (
          <button className="button primary" onClick={onBook}>
            <CalendarDays size={16} />
            Book appointment
          </button>
        )}
      </section>
    </div>
  );
}
export function CourseDrawer({
  id,
  onClose,
  onPatient,
}: {
  id: string;
  onClose: () => void;
  onPatient: (p: Patient) => void;
}) {
  const ref = useDialogFocus(onClose);
  const { state } = useClinic();
  const course = state.records["Treatment Plans"].find((r) => r.id === id);
  if (!course) return null;
  const patient = state.patients.find((p) => p.id === course.patientId);
  const visits = state.appointments.filter((a) => a.courseId === id);
  return (
    <div className="overlay drawer-overlay" onMouseDown={onClose}>
      <section
        ref={ref}
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Treatment course"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header>
          <span>Treatment course</span>
          <button className="icon" aria-label="Close course" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        <span className="record-icon">
          <ClipboardList size={23} />
        </span>
        <h2>{course.name}</h2>
        <p className="muted">{course.id}</p>
        <Badge>{course.status}</Badge>
        <h3>Clinician-approved course</h3>
        <p className="course-description">{course.detail.split(" ? ")[0]}</p>
        <div className="course-progress">
          <span>
            {course.completedSittings || 0} of {course.totalSittings || 6}{" "}
            sittings completed
          </span>
          <progress
            max={course.totalSittings || 6}
            value={course.completedSittings || 0}
          />
        </div>
        {patient && (
          <button className="course-link" onClick={() => onPatient(patient)}>
            <Avatar name={patient.name} />
            <span>
              <strong>{patient.name}</strong>
              <small>{patient.id} · Open patient</small>
            </span>
            <ArrowUpRight size={15} />
          </button>
        )}
        <h3>Course sittings</h3>
        {visits.map((a) => (
          <div key={a.id} className="profile-appointment">
            <div>
              <strong>
                Sitting {a.sitting || 1} of {a.totalSittings || 6}
              </strong>
              <small>
                {dayLabel(a.date)} · {a.time} · {a.doctor}
              </small>
            </div>
            <Badge>{a.status}</Badge>
          </div>
        ))}
        {!visits.length && (
          <p className="muted">No sittings booked for this course.</p>
        )}
        <h3>Recorded payments</h3>
        {state.records["Payments"]
          .filter((r) => r.patientId === course.patientId)
          .map((r) => (
            <div key={r.id} className="profile-appointment">
              <span>{r.date ? dayLabel(r.date) : "Demo payment"}</span>
              <strong>{money(r.amount)}</strong>
            </div>
          ))}
        <div className="info-strip">
          For recording clinician-approved care only. This demo does not
          generate treatment prescriptions.
        </div>
      </section>
    </div>
  );
}
