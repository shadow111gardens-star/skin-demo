import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "../../components";
import { DEMO_DATE, type RecordItem } from "../../data";
import {
  OperationHeader,
  Metrics,
  OperationForm,
  DetailList,
  Empty,
  useOperation,
  actor,
  options,
} from "./OperationsUI";
import { saveRoom } from "./services";
function overlap(
  a: { time: string; duration?: number },
  b: { time: string; duration?: number },
) {
  const minute = (v: string) =>
    Number(v.slice(0, 2)) * 60 + Number(v.slice(3, 5));
  return (
    minute(a.time) < minute(b.time) + (b.duration || 30) &&
    minute(b.time) < minute(a.time) + (a.duration || 30)
  );
}
export default function Rooms() {
  const { state, commit } = useOperation(),
    [edit, setEdit] = useState<RecordItem | null | undefined>(),
    [q, setQ] = useState(""),
    [status, setStatus] = useState("");
  const rooms = state.records["Rooms & Resources"],
    visits = state.appointments.filter(
      (a) =>
        a.date === DEMO_DATE &&
        !["Cancelled", "No-show", "Waiting list", "Rescheduled"].includes(
          a.status,
        ),
    ),
    conflicts = visits.flatMap((a, i) =>
      visits
        .slice(i + 1)
        .filter((b) => a.room === b.room && overlap(a, b))
        .map((b) => [a, b]),
    );
  const rows = rooms.filter(
    (r) =>
      (r.name + " " + r.room?.code).toLowerCase().includes(q.toLowerCase()) &&
      (!status || status === r.status),
  );
  return (
    <div className="operations-page">
      <OperationHeader
        title="Rooms & Resources"
        description="Exclusive booking resources, home equipment and today's assignments."
        action={
          <button className="button primary" onClick={() => setEdit(null)}>
            + Add room
          </button>
        }
      />
      <Metrics
        items={[
          ["Clinic rooms", rooms.length],
          [
            "Available rooms",
            rooms.filter((r) => r.status === "Available").length,
          ],
          ["Today's assignments", visits.length],
          ["Room conflicts", conflicts.length],
        ]}
      />
      <div className="operations-filters card">
        <label>
          Search rooms
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Room name or code"
          />
        </label>
        <label>
          Availability
          <select
            aria-label="Availability"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All rooms</option>
            <option>Available</option>
            <option>Unavailable</option>
          </select>
        </label>
        <button
          className="button"
          onClick={() => {
            setQ("");
            setStatus("");
          }}
        >
          Reset
        </button>
      </div>
      {!!conflicts.length && (
        <section className="card operations-warning">
          <h2>Assignment conflicts requiring review</h2>
          {conflicts.map(([a, b]) => (
            <p key={a.id + b.id}>
              {a.room}: {a.time} ({a.id}) overlaps {b.time} ({b.id}).{" "}
              <Link
                className="text-link"
                to={"/appointments?appointment=" + a.id + "&date=" + a.date}
              >
                Review booking
              </Link>
            </p>
          ))}
        </section>
      )}
      <div className="operations-room-grid">
        {rows.map((r) => (
          <section className="card operations-room" key={r.id}>
            <div className="operations-split">
              <div>
                <small>{r.room?.code}</small>
                <h2>{r.name}</h2>
              </div>
              <Badge>{r.status}</Badge>
            </div>
            <DetailList
              items={[
                ["Seating capacity", r.room?.capacity],
                ["Booking policy", "One appointment at a time"],
                [
                  "Home equipment",
                  state.records["Machines & Equipment"]
                    .filter((m) => m.machine?.roomId === r.id)
                    .map((m) => (
                      <Link
                        className="text-link"
                        key={m.id}
                        to={"/machines-equipment/" + m.id}
                      >
                        {m.name}{" "}
                      </Link>
                    )),
                ],
                ["Notes", r.room?.notes],
              ]}
            />
            <h3>Today's assignments · {DEMO_DATE}</h3>
            {visits
              .filter((a) => a.room === r.room?.code)
              .sort((a, b) => a.time.localeCompare(b.time))
              .map((a) => (
                <Link
                  className="operations-mini-row"
                  key={a.id}
                  to={"/appointments?appointment=" + a.id + "&date=" + a.date}
                >
                  <strong>{a.time}</strong>
                  <span>
                    {state.patients.find((p) => p.id === a.patientId)?.name}
                    <small>
                      {a.treatment} · {a.duration || "Unrecorded"} min
                    </small>
                  </span>
                  <Badge>{a.status}</Badge>
                </Link>
              ))}
            {!visits.some((a) => a.room === r.room?.code) && (
              <Empty>No assignments on the demo operating day.</Empty>
            )}
            <button className="button" onClick={() => setEdit(r)}>
              Edit room / availability
            </button>
          </section>
        ))}
      </div>
      {!rows.length && (
        <section className="card">
          <Empty>
            No rooms match these filters. Reset filters or register a room.
          </Empty>
        </section>
      )}
      {edit !== undefined && (
        <OperationForm
          title={edit ? "Edit room" : "Create room"}
          initial={{
            name: edit?.name || "",
            code: edit?.room?.code || "",
            capacity: String(edit?.room?.capacity || 1),
            status: edit?.status || "Available",
            notes: edit?.room?.notes || "",
          }}
          fields={[
            { key: "name", label: "Room name", required: true },
            { key: "code", label: "Room code", required: true },
            {
              key: "capacity",
              label: "Seating capacity",
              type: "number",
              required: true,
              help: "Room remains an exclusive appointment resource.",
            },
            {
              key: "status",
              label: "Availability",
              options: options(["Available", "Unavailable"]),
            },
            { key: "notes", label: "Notes", type: "textarea" },
          ]}
          confirmation="I confirm room changes. Unavailable rooms cannot accept new bookings; existing assignments remain visible for review."
          onClose={() => setEdit(undefined)}
          onSave={(v, c) =>
            commit(
              (s) =>
                saveRoom(
                  s,
                  {
                    ...edit,
                    id: edit?.id || "room-" + crypto.randomUUID(),
                    name: v.name,
                    status: v.status,
                    detail: v.notes,
                    amount: 0,
                    room: {
                      code: v.code,
                      capacity: Number(v.capacity),
                      notes: v.notes,
                      events: edit?.room?.events || [],
                    },
                  },
                  actor,
                  c,
                ),
              "Room saved",
            )
          }
        />
      )}
    </div>
  );
}
