import { useEffect, useState } from "react";
import { api } from "../../api";

type UnmatchedEvent = {
  id: string;
  subject: string;
  attendeeEmail?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  connectionProvider: string;
};

type OrgOption = { id: string; name: string };
type OrgMember = { userId: string; email: string; firstName: string; lastName: string };
type RowMode = "existing" | "new";

/// Admin review queue for external calendar events whose attendee email didn't match any
/// known CRM contact. See docs/calendar-sync.md — resolving either picks an existing
/// organization/contact, or creates a brand-new client from the event's attendee email
/// (same account-creation path as the Users screen: temporary password, activation email).
export function AdminUnmatchedCalendarEvents() {
  const [items, setItems] = useState<UnmatchedEvent[]>([]);
  const [organizations, setOrganizations] = useState<OrgOption[]>([]);
  const [membersByOrg, setMembersByOrg] = useState<Record<string, OrgMember[]>>({});
  const [selectedOrg, setSelectedOrg] = useState<Record<string, string>>({});
  const [selectedMember, setSelectedMember] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<Record<string, RowMode>>({});
  const [newOrgName, setNewOrgName] = useState<Record<string, string>>({});
  const [newFirstName, setNewFirstName] = useState<Record<string, string>>({});
  const [newLastName, setNewLastName] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [rowError, setRowError] = useState<Record<string, string>>({});

  const load = () => {
    api<UnmatchedEvent[]>("/api/admin/calendar/unmatched-events")
      .then(setItems)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unavailable."));
  };

  useEffect(() => {
    load();
    api<OrgOption[]>("/api/admin/organizations").then(setOrganizations).catch(() => {});
  }, []);

  const loadMembers = async (eventId: string, organizationId: string) => {
    setSelectedOrg((prev) => ({ ...prev, [eventId]: organizationId }));
    if (!membersByOrg[organizationId]) {
      const detail = await api<{ members: { userId: string; email: string; firstName: string; lastName: string }[] }>(
        `/api/admin/organizations/${organizationId}`,
      );
      setMembersByOrg((prev) => ({ ...prev, [organizationId]: detail.members }));
    }
  };

  const nameFromEmail = (email?: string | null) => {
    const local = (email ?? "").split("@")[0] ?? "";
    const parts = local.split(/[._-]+/).filter(Boolean);
    return {
      firstName: parts[0] ? parts[0][0].toUpperCase() + parts[0].slice(1) : "",
      lastName: parts[1] ? parts[1][0].toUpperCase() + parts[1].slice(1) : "",
    };
  };

  const startNewClient = (item: UnmatchedEvent) => {
    setMode((prev) => ({ ...prev, [item.id]: "new" }));
    const guess = nameFromEmail(item.attendeeEmail);
    setNewFirstName((prev) => ({ ...prev, [item.id]: prev[item.id] ?? guess.firstName }));
    setNewLastName((prev) => ({ ...prev, [item.id]: prev[item.id] ?? guess.lastName }));
  };

  const resolveExisting = async (eventId: string) => {
    const organizationId = selectedOrg[eventId];
    const requestedByUserId = selectedMember[eventId];
    if (!organizationId || !requestedByUserId) return;
    setRowError((prev) => ({ ...prev, [eventId]: "" }));
    try {
      await api(`/api/admin/calendar/unmatched-events/${eventId}/resolve`, {
        method: "POST",
        body: JSON.stringify({ organizationId, requestedByUserId }),
      });
      load();
    } catch (reason) {
      setRowError((prev) => ({ ...prev, [eventId]: reason instanceof Error ? reason.message : "Failed." }));
    }
  };

  const resolveNew = async (item: UnmatchedEvent) => {
    const organizationName = newOrgName[item.id]?.trim();
    const firstName = newFirstName[item.id]?.trim();
    const lastName = newLastName[item.id]?.trim();
    const email = item.attendeeEmail?.trim();
    if (!organizationName || !firstName || !lastName || !email) return;
    setRowError((prev) => ({ ...prev, [item.id]: "" }));
    try {
      await api(`/api/admin/calendar/unmatched-events/${item.id}/resolve`, {
        method: "POST",
        body: JSON.stringify({
          newOrganizationName: organizationName,
          newContactFirstName: firstName,
          newContactLastName: lastName,
          newContactEmail: email,
        }),
      });
      load();
    } catch (reason) {
      setRowError((prev) => ({ ...prev, [item.id]: reason instanceof Error ? reason.message : "Failed." }));
    }
  };

  const ignore = async (eventId: string) => {
    await api(`/api/admin/calendar/unmatched-events/${eventId}/ignore`, { method: "POST" });
    load();
  };

  if (error) return <p className="form-error">{error}</p>;
  if (items.length === 0) return null;

  return (
    <div className="form-card unmatched-calendar-card">
      <strong>Непрепознаени календарски настани</strong>
      <p className="calendar-connect-hint">
        Настани од поврзаните календари чиј учесник не се совпаѓа со ниту еден постоечки клиент. Избери постоечка организација и контакт, или создади нов клиент директно од е-поштата на учесникот.
      </p>
      {items.map((item) => {
        const rowMode = mode[item.id] ?? "existing";
        const orgId = selectedOrg[item.id] ?? "";
        const members = orgId ? (membersByOrg[orgId] ?? []) : [];
        return (
          <div key={item.id} className="unmatched-calendar-row-wrap">
            <div className="unmatched-calendar-row">
              <div>
                <strong>{item.subject || "(без наслов)"}</strong>
                <small>
                  {item.attendeeEmail ?? "нема учесник"} · {item.connectionProvider} ·{" "}
                  {item.startsAt ? new Date(item.startsAt).toLocaleString("mk-MK") : ""}
                </small>
              </div>
              {rowMode === "existing" ? (
                <>
                  <select value={orgId} onChange={(e) => void loadMembers(item.id, e.target.value)}>
                    <option value="">Избери организација</option>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={selectedMember[item.id] ?? ""}
                    onChange={(e) => setSelectedMember((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    disabled={!orgId}
                  >
                    <option value="">Избери контакт</option>
                    {members.map((member) => (
                      <option key={member.userId} value={member.userId}>
                        {member.firstName} {member.lastName} ({member.email})
                      </option>
                    ))}
                  </select>
                  <div className="unmatched-calendar-actions">
                    <button
                      type="button"
                      onClick={() => void resolveExisting(item.id)}
                      disabled={!orgId || !selectedMember[item.id]}
                    >
                      Внеси
                    </button>
                    <button type="button" className="secondary" onClick={() => startNewClient(item)}>
                      Нов клиент
                    </button>
                    <button type="button" className="secondary" onClick={() => void ignore(item.id)}>
                      Игнорирај
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <input
                    placeholder="Име на организација"
                    value={newOrgName[item.id] ?? ""}
                    onChange={(e) => setNewOrgName((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  />
                  <input
                    placeholder="Име"
                    value={newFirstName[item.id] ?? ""}
                    onChange={(e) => setNewFirstName((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  />
                  <input
                    placeholder="Презиме"
                    value={newLastName[item.id] ?? ""}
                    onChange={(e) => setNewLastName((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  />
                  <div className="unmatched-calendar-actions">
                    <button
                      type="button"
                      onClick={() => void resolveNew(item)}
                      disabled={!newOrgName[item.id] || !newFirstName[item.id] || !newLastName[item.id] || !item.attendeeEmail}
                    >
                      Создади и внеси
                    </button>
                    <button type="button" className="secondary" onClick={() => setMode((prev) => ({ ...prev, [item.id]: "existing" }))}>
                      Назад
                    </button>
                  </div>
                </>
              )}
            </div>
            {rowError[item.id] && <p className="form-error">{rowError[item.id]}</p>}
          </div>
        );
      })}
    </div>
  );
}
