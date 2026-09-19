# ADR 0001: Shared-database tenancy

- Status: accepted and implemented
- Scope: BAU, DIGITMAK, VEZILKA and HPC

## Decision

Run one reusable modular application over one shared database. Identify each participating organisation as a tenant. Keep user identity global and model access through tenant memberships. Require a tenant key on every tenant-owned aggregate and expose cross-tenant reporting only through an explicit platform-administrator authorization path.

## Why

The shared model supports immediate central reporting such as service adoption by BAU, DIGITMAK, VEZILKA or HPC, avoids four divergent codebases, and permits a person to belong to more than one tenant. A tenant column only on the user would not handle shared users, background work, public contact intake or records transferred between organisations safely.

## Consequences

- Tenant resolution and authorization become security boundaries, not UI filters.
- All queries, writes, exports, files, notifications, realtime groups and scheduled jobs must carry tenant context.
- Central reporting reads across tenants only under `PlatformAdmin`; tenant administrators remain filtered.
- Existing data needs an explicit, backed-up tenant backfill before the first shared production rollout.
- `ITenantContext`, tenant query filters, server-assigned keys and tenant memberships jointly enforce the boundary.
