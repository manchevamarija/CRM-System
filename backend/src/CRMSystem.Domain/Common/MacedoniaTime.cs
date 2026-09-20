namespace CRMSystem.Domain.Common;

/// <summary>
/// Converts a stored UTC instant to Macedonia's actual wall-clock time (Europe/Skopje,
/// UTC+1 in winter / UTC+2 in summer with automatic DST handling), regardless of what
/// timezone the server/container itself happens to be running in. .NET's own
/// DateTimeOffset.ToLocalTime() depends on the machine's configured local timezone —
/// production containers commonly default to UTC, which silently turns ToLocalTime()
/// into a no-op and leaves every displayed time exactly 1-2 hours behind. Every
/// user-facing date/time (PDF, email, notification, report) must go through this
/// instead of ToLocalTime() so the displayed time is correct no matter how the host
/// machine itself is configured.
/// </summary>
public static class MacedoniaTime
{
    private static readonly TimeZoneInfo Zone = ResolveZone();

    private static TimeZoneInfo ResolveZone()
    {
        try
        {
            // IANA id — what Linux/Docker containers (production) use.
            return TimeZoneInfo.FindSystemTimeZoneById("Europe/Skopje");
        }
        catch (TimeZoneNotFoundException)
        {
            try
            {
                // Windows id — what a developer's local machine uses.
                return TimeZoneInfo.FindSystemTimeZoneById("Central Europe Standard Time");
            }
            catch (TimeZoneNotFoundException)
            {
                // Last-resort fallback: fixed UTC+1 with no DST. Still far closer to
                // correct than silently leaving times in UTC.
                return TimeZoneInfo.CreateCustomTimeZone("Skopje-Fallback", TimeSpan.FromHours(1), "Skopje (fallback)", "Skopje (fallback)");
            }
        }
    }

    /// <summary>Converts a UTC (or any) instant to Macedonia's local wall-clock time.</summary>
    public static DateTimeOffset ToSkopje(this DateTimeOffset instant) =>
        TimeZoneInfo.ConvertTime(instant, Zone);
}
