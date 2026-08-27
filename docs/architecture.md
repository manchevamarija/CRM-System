# CRM System architecture

The same modular application supports BAU, DIGITMAK, VEZILKA and HPC. Brand identity is an outer tenant concern and does not introduce organisation-specific branches into domain or application logic. One shared database is protected by mandatory tenant query filters, server-assigned tenant keys and staff memberships. See `multi-brand.md`.

## Style

The backend is a modular monolith with Onion-style project boundaries. One deployable API process hosts the HTTP surface, while the domain, application contracts and infrastructure remain separate assemblies. SQLite is used for local development and PostgreSQL is the production transactional boundary.

## Dependency direction

```text
CRMSystem.Api (controllers and composition root)
        ↓
CRMSystem.Application (contracts and use cases)
        ↓
CRMSystem.Domain (entities and business vocabulary)

CRMSystem.Infrastructure implements Application contracts and depends on Domain.
CRMSystem.Api references Infrastructure only to compose the executable application.
```

`Program.cs` is the composition root: configuration, middleware and dependency injection. Controllers form the transport layer and delegate reusable workflows to application services. A small number of administration read models use EF Core directly for efficient projections; this is a deliberate pragmatic boundary, not a claim of strict Clean Architecture.

## Source layout

```text
backend/src/
├── CRMSystem.Domain/          entities, identity vocabulary and rules
├── CRMSystem.Application/     contracts, abstractions and use cases
├── CRMSystem.Infrastructure/  EF Core, SMTP, storage and external integrations
└── CRMSystem.Api/
    ├── Web/Controllers/       public, client, staff and admin HTTP endpoints
    ├── Program.cs             executable composition root
    └── Properties/            local launch configuration
```

## Repository decision

The project intentionally does not wrap EF Core in a generic `IRepository<T>`. `DbContext` already implements unit-of-work and repository semantics; another generic layer would hide useful EF Core features without adding a business boundary. Reusable workflows such as ticket entitlement, messages, meetings and public contact intake live behind focused application-service interfaces. Read-only administration queries remain in their feature module. A specialised repository should be introduced only when a complex aggregate query needs reuse outside its module.

## Module responsibilities

- Public: localized services and public contact intake with explicit six-value DMA classification.
- Identity: registration, login, refresh rotation, revocation, verification and password reset.
- Clients: organizations, subscriber tickets, chat and meeting requests.
- Staff: triage, assignment, internal notes and meeting decisions.
- Administration: approvals, subscriptions, users, audit and reports.
- Files: validated private upload/download through the storage abstraction.

## Tenant boundary

Application services consume `ITenantContext`; infrastructure resolves the active centre from trusted deployment/host configuration. The database uses global identity plus `UserTenantMemberships`, while every tenant-owned aggregate carries a required `TenantId`. EF Core applies central query filters, assigns tenant keys on inserts and rejects cross-tenant updates even when a filter is bypassed. Cross-tenant contact-request handover is an explicit audited workflow; general cross-tenant access is not granted to ordinary tenant administrators.

## Cross-cutting infrastructure

- ASP.NET Identity and JWT bearer authentication, with persisted user lifecycle timestamps and an active-account middleware check on every authenticated request.
- Role policies plus server-side resource authorization.
- EF Core/PostgreSQL migrations in production and a versioned, idempotent SQLite schema upgrader for existing local databases.
- SignalR ticket groups.
- Brevo SMTP queue worker.
- VM disk storage behind `IFileStorage`, with extension/MIME binding, content-signature validation, root-path containment and ClamAV scanning through `IFileScanner`.
- Rate limiting, security headers, audit records and health checks.
- Trusted forwarded-header processing behind Nginx, dynamic production-domain rendering and systemd-managed backup/TLS schedules.

## Frontend structure

```text
frontend/src/
├── app/                    composition and view orchestration
├── components/layout/      shared header and footer
├── content/                localized portal copy and catalogue data
├── features/auth/          auth context, provider and hooks
├── pages/public/           public portal and contact intake
├── pages/client/           subscriber dashboard and resources
├── features/admin/         focused administration panels and workflows
├── features/meetings/      shared client/staff meeting calendar
├── pages/admin/            administration page composition
├── shared/                 shared types and API resource hooks
├── api.ts                  centralized authenticated HTTP client
└── styles                  application styling
```

Authentication state, API access, feature modules and page composition are separated. Large workflows are split into focused components; localized content data is kept outside rendering components. The shared API client serializes concurrent refresh attempts into one refresh-token rotation. Client, staff and admin dashboards are protected routes and load only authorised API resources. Their operational interface is localised in Macedonian, English and Albanian, including responsive workspace navigation.
