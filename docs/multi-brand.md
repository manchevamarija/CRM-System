# Multi-tenant and multi-brand direction

CRM System is one reusable codebase for BAU, DIGITMAK, VEZILKA and HPC. The runtime supports one API and one shared database, with a central platform view that can report which tenant uses which services. Brand identity remains configuration/data; business workflows must not be copied or forked per organisation.

## Current implementation boundary

The current release implements shared-database isolation for organisations, memberships, subscriptions, tickets/messages/attachments, meetings, notifications, service/content data, evidence/KPI data, audit records and operational settings. Identity is global; staff authority is granted through tenant-scoped `UserTenantMemberships`. EF Core centrally filters reads, assigns `TenantId` on inserts and blocks foreign-tenant writes.

Every contact request stores its immutable entry centre (`CreatedTenantId`) and its current responsible centre (`OwnerTenantId`). A handover changes ownership on the same request and writes an immutable `ContactRequestTransfer`; it never creates a duplicate request. Services, documents, client identity, CRM stage and reference number remain attached to that request. The source centre retains history visibility and the current owner has mutation authority.

`ITenantContext` is the boundary used by persistence, e-mail, PDF and workflow services, while `ITenantDirectory` supplies participating centres. PostgreSQL schema changes are versioned EF migrations. Existing local SQLite databases are upgraded by the idempotent compatibility upgrader.

## Contact-request handover now

1. The receiving centre creates the contact request with the same value in `CreatedTenantId` and `OwnerTenantId`.
2. Its administrator selects BAU, DIGITMAK, VEZILKA or HPC and records a required handover reason.
3. The API atomically changes `OwnerTenantId`, clears centre-specific staff assignments and appends a `ContactRequestTransfer` service snapshot.
4. The source retains a read-only history view; the destination continues the same request and may add, remove or update services.
5. The client receives a localised e-mail and PDF showing the unchanged reference, current services, previous centre, new responsible centre and reason.

## Shared data model

The platform includes:

- `Tenants`: stable ID/code, display name, legal name, status, colours, logos, website and support/sender addresses.
- `TenantDomains`: verified hostnames mapped to one tenant.
- `UserTenantMemberships`: `UserId`, `TenantId`, role and status. Identity remains global so one person may legitimately work with more than one tenant.

Every tenant-owned record carries a required `TenantId`, including organisations, service items, tickets, messages, meetings, subscriptions, notifications, content/catalogue overrides, KPI/evidence data, audit records, uploaded-file metadata and operational settings. Identity remains global, while uploaded objects are stored under tenant-specific paths and protected by tenant query filters as well as their parent resource authorization. Shared reference data may remain global only when that is an explicit product decision.

Use tenant-aware uniqueness, for example `(TenantId, ReferenceNumber)`, `(TenantId, TicketNumber)` and `(TenantId, ServiceSlug)`. Store uploaded objects below a tenant namespace and include the tenant in cache keys, background-job payloads and SignalR groups.

## Enforcement rules

1. Resolve the tenant from a verified hostname or a server-issued token claim. Never trust an arbitrary `TenantId` sent by the browser.
2. Validate an active `UserTenantMembership` on every authenticated request.
3. Apply tenant query filters centrally and set `TenantId` server-side on inserts. Query filters are defence in depth, not a replacement for resource authorization.
4. Permit cross-tenant queries only to an explicit `PlatformAdmin` policy. Normal BAU, DIGITMAK, VEZILKA and HPC administrators remain tenant-scoped.
5. Persist `TenantId` with notifications and scheduled work; background jobs have no browser request from which to infer it.
6. Test isolation: a user, ID, export URL or file path from tenant A must never return data from tenant B.

## Deployment and migration sequence

1. Back up an existing database and classify each legacy record under the correct centre.
2. Apply the PostgreSQL EF migrations and backfill `TenantId`/membership values before serving traffic.
3. Configure only verified tenant hostnames and centre profiles.
4. Run the automated isolation suite and verify counts per centre.
5. Enable central reporting only behind a dedicated future `PlatformAdmin` policy.

## Brand configuration today

Set `BRAND_ID` to `bau`, `digitmak`, `vezilka` or `hpc`, plus `BRAND_NAME`, `BRAND_LEGAL_NAME`, colours, logo URLs, website and support email. The frontend also recognises those names in the hostname. These profiles select presentation and the trusted tenant context; they do not weaken the database boundary.

Brand-specific presentation belongs in `frontend/src/config/brand.ts`, tenant records and deployment settings. Controllers and application services must depend on `ITenantContext`, not branch on literal names such as BAU or HPC.
