import { useEffect, useState } from "react";
import { api, getAccessToken } from "../../api";

type ConnectionStatus = {
  provider: "Google" | "Microsoft";
  connectedEmail: string;
  lastSyncedAt?: string | null;
};

/// Lets the signed-in staff member connect their own Google or Microsoft calendar, so
/// confirmed meetings push there automatically with the client added as an attendee.
/// This is a per-person setting — each staff member connects their own account once.
export function StaffCalendarConnect({ compact = false }: { compact?: boolean } = {}) {
  const [connections, setConnections] = useState<ConnectionStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    api<ConnectionStatus[]>("/api/staff/calendar/status")
      .then(setConnections)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Calendar status unavailable."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // If we just came back from a provider's consent screen, refresh the status once more
    // after a short delay, since the redirect target already lands on this tab.
    if (new URLSearchParams(location.search).get("calendarConnected")) {
      setTimeout(load, 300);
    }
  }, []);

  const connect = (provider: "google" | "microsoft") => {
    const token = getAccessToken();
    if (!token) return;
    window.location.href = `/api/staff/calendar/connect/${provider}?access_token=${encodeURIComponent(token)}`;
  };

  const disconnect = async (provider: "Google" | "Microsoft") => {
    try {
      await api(`/api/staff/calendar/disconnect/${provider}`, { method: "POST" });
      load();
    } catch {
      // No-op — the list simply keeps its previous state if the disconnect call fails.
    }
  };

  if (loading) return null;

  const has = (provider: "Google" | "Microsoft") => connections.find((x) => x.provider === provider);
  const google = has("Google");
  const microsoft = has("Microsoft");

  const buttons = (
    <div className="calendar-connect-row">
      {google ? (
        <span className="calendar-connected-badge">
          <GoogleIcon />
          {google.connectedEmail || "Поврзано"}
          <button type="button" className="calendar-disconnect-btn" onClick={() => void disconnect("Google")}>
            Исклучи
          </button>
        </span>
      ) : (
        <button type="button" className="provider-connect-btn" onClick={() => connect("google")} title="Поврзи Google Calendar">
          <GoogleIcon />
          {!compact && "Поврзи Google Calendar"}
        </button>
      )}
      {microsoft ? (
        <span className="calendar-connected-badge">
          <MicrosoftIcon />
          {microsoft.connectedEmail || "Поврзано"}
          <button type="button" className="calendar-disconnect-btn" onClick={() => void disconnect("Microsoft")}>
            Исклучи
          </button>
        </span>
      ) : (
        <button type="button" className="provider-connect-btn" onClick={() => connect("microsoft")} title="Поврзи Outlook">
          <MicrosoftIcon />
          {!compact && "Поврзи Outlook"}
        </button>
      )}
    </div>
  );

  if (compact) {
    return (
      <>
        {error && <p className="form-error">{error}</p>}
        {buttons}
      </>
    );
  }

  return (
    <div className="form-card calendar-connect-card">
      <strong>Календар</strong>
      <p className="calendar-connect-hint">
        Поврзи го својот календар за потврдените состаноци автоматски да се појавуваат таму, со поканата до клиентот испратена сама.
      </p>
      {error && <p className="form-error">{error}</p>}
      {buttons}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.5 0 10.4-1.9 14.1-5.1l-6.5-5.5C29.7 34.9 27 36 24 36c-5.2 0-9.6-3.3-11.2-7.9l-6.5 5C9.6 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.4l6.5 5.5C39.9 37 44 31 44 24c0-1.2-.1-2.4-.4-3.5z"/>
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 21 21" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}
