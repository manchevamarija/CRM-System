# CRM System

CRM System is a multilingual web platform that combines a public service portal and help-desk system with a complete client relationship and service-delivery workflow. Public content, client accounts, organizations, subscriptions, tickets, meetings, documents, notifications, reporting, and CRM intake are maintained in one application.

The repository is the shared implementation for BAU, DIGITMAK, VEZILKA and HPC. Branding is tenant-driven; application code and business workflows remain reusable. Contact requests support one-record inter-centre handover with immutable transfer history, preserved services/documents/reference, and a localised e-mail/PDF confirmation. Official confirmation and handover document templates are stored in [output/pdf](output/pdf). The production model is one shared database with enforced tenant isolation for all tenant-owned modules. See [docs/multi-brand.md](docs/multi-brand.md) and [ADR 0001](docs/adr/0001-shared-database-tenancy.md).

## System Functionality

### Public website

- Public home page with CRM System information, service presentation, partners, and calls to action.
- Separate service and training pages.
- Public support/help-desk entry page.
- Contact flow for consultation or long-term cooperation, with fields that adapt to the selected request type.
- Shopping cart for creating a package from one or more CRM System services; no online payment is performed.
- Contact, company, requirements, budget, deadline, and selected-service data are saved as one CRM request.
- Every submission receives a reference number and starts in the **Applied** status.
- The confirmation page displays the reference, initial status, selected services, and profile-creation action.
- Registration with the same email automatically links the submitted request to the client profile.
- Privacy, terms, accessibility, and other compliance pages.
- Public content is managed from the administration area instead of being fixed only in the frontend.
- Responsive navigation and layouts for desktop and mobile devices.

### Authentication and account access

- Registration and email/password sign-in through ASP.NET Core Identity.
- JWT-based authenticated API access.
- Forgotten-password and password-reset flow.
- Protected client, staff, and administrator routes.
- Active-user validation without logging the user out during every normal action.
- Profile management and password changes from the portal.
- Role and permission changes are reflected in the interface without requiring a manual browser refresh.

### Client portal

- Personal dashboard with an overview of CRM requests, selected services, active work, tickets, meetings, subscription, and organization.
- Seven-stage CRM timeline: **Applied**, **Contacting**, **Assigned to an agent**, **Services confirmed**, **Service in progress**, **Follow up**, and **Served**.
- Every selected service has its own status, price, deadline, and responsible agent.
- CRM changes appear in real time through SignalR.
- Organization profile visibility after an administrator links the client; organization creation remains an administrative responsibility.
- Subscription invitations and subscription status.
- Help-desk ticket creation, categorization, priority, status tracking, and conversation history.
- Ticket attachments and document preview/download.
- Meetings, calendar overview, and downloadable calendar events.
- In-app notifications with read/unread state and direct links to the relevant item.
- Account-change requests and profile settings.

### Staff workspace

- Staff view of assigned tickets, clients, organizations, meetings, and contact requests.
- CRM processing with client contact, agent assignment, overall-stage changes, and management of every selected service.
- Ticket processing, conversation, assignment, priority, and lifecycle updates.
- Contact-request review and follow-up.
- Organization and meeting management.
- Access is restricted by staff/agent roles.

### Administration

- Administrative overview, operational dashboard, and statistics for all seven CRM stages.
- Client counts and percentages per stage with access to the underlying requests.
- Management of tickets, contact requests, organizations, subscriptions, meetings, documents, and users.
- Account activation/deactivation and assignment/removal of roles.
- Creation of custom role names from the interface.
- User creation with a unique cryptographically generated temporary password sent through Brevo SMTP.
- Mandatory password replacement after the invited user's first successful sign-in.
- User and role changes appear immediately without a manual browser refresh.
- Notification management and administrative announcements.
- Public content and service catalogue management.
- Audit trail for important administrative and security actions.
- Reports and downloadable spreadsheet exports.
- System settings, evidence/records, and account-change request processing.

### Platform administration

- Dedicated `PlatformAdmin` role and authorization policy for global cross-tenant operations.
- Separate `/platform-admin` interface for centre-level totals, global users, tenant memberships, and recent audit events.
- `/api/platform-admin/*` endpoints use explicit platform-admin authorization before reading across tenant query filters.
- Tenant administrators remain scoped to their own centre; they cannot assign or remove the `PlatformAdmin` role.

### Platform services

- Real-time ticket, notification, and CRM updates through SignalR.
- PostgreSQL persistence through Entity Framework Core.
- Versioned PostgreSQL migrations, tenant-scoped EF query filters, staff memberships, and cross-tenant write protection.
- File-storage abstraction for uploaded documents.
- Background jobs for notification delivery, subscription maintenance, data retention, and ticket escalation.
- Health endpoints for liveness and production readiness.
- Docker and production deployment configuration, backup/restore scripts, TLS/nginx templates, and validation scripts.

### Languages

The public, authentication, client CRM, and administration interfaces support Macedonian (`mk`), English (`en`), and Albanian (`sq`).

## Technologies

### Backend

- .NET 10 Web API
- Entity Framework Core
- PostgreSQL
- ASP.NET Core Identity
- JWT authentication
- SignalR

### Frontend

- React
- TypeScript
- Vite
- React Router
- i18next

## Architecture and Project Structure

The backend is a modular monolith with Onion Architecture boundaries and dependency injection.

```text
backend/src/CRMSystem.Domain/          Entities and domain rules
backend/src/CRMSystem.Application/     Use-case contracts and application logic
backend/src/CRMSystem.Infrastructure/  EF Core, Identity, SMTP, files and SignalR
backend/src/CRMSystem.Api/             HTTP API and composition root
frontend/src/features/                       Feature-focused React components
frontend/src/pages/                          Route-level screens
frontend/src/content/                        Macedonian, English and Albanian copy
frontend/src/styles/                         Component and layout styles
deploy/                                      Deployment configuration and scripts
docs/                                        Architecture and operations documentation
```

Dependencies point inward: Infrastructure implements Application contracts, Domain remains independent of persistence and HTTP, and the API is the composition root. Frontend components and hooks are divided by responsibility for reuse and maintenance.

Automated backend tests live in `backend/tests/CRMSystem.Infrastructure.Tests` and verify tenant read/write isolation, one-record handover visibility and PDF generation in Macedonian, English and Albanian.

## Local Development

### Start the Backend

Run:

```text
START-BACKEND.cmd
```

The backend API will be available at:

```text
http://localhost:5241
```

### Start the Frontend

Run:

```text
START-FRONTEND.cmd
```

The frontend will be available at:

```text
http://localhost:5173
```

To start both applications together, run:

```text
START-FULL-SYSTEM.cmd
```

## Local Demo Accounts

Development/demo accounts can be bootstrapped locally, but shared usernames and passwords must not be published in this repository. Configure local credentials through environment variables or a private local settings file that is not committed.

Agent, help-desk advisor, and expert accounts are not populated with shared demo
credentials. The administrator creates each real staff account from **Users** and
assigns the appropriate role. This keeps ownership and audit history tied to a
named person instead of a generic mailbox.

Production administrator credentials must be provided through the following environment variables:

- `ADMIN_BOOTSTRAP_EMAIL`
- `ADMIN_BOOTSTRAP_PASSWORD`

The bootstrap administrator is also granted `PlatformAdmin` in local/default deployments. In production, set `PLATFORM_ADMIN_EMAIL` when only one specific bootstrap mailbox should receive platform-wide access.

## Manual Start

### Backend

```powershell
dotnet run --project backend/src/CRMSystem.Api
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

## Docker

Start the complete local environment with:

```powershell
docker compose up --build
```

## Documentation

Technical documentation is available in the `docs` directory.

Additional setup and project handover information is available in `HANDOFF-MK.md`.

## Email Configuration

Email delivery uses real SMTP configuration supplied outside source control:

- `BREVO_SMTP_HOST`
- `BREVO_SMTP_PORT` (defaults to `587`)
- `BREVO_SMTP_USERNAME`
- `BREVO_SMTP_PASSWORD`
- `BREVO_SMTP_USE_SSL`

The former local email viewer on port `8025` is not part of the application.

## Build verification

```powershell
dotnet build CRMSystem.slnx
cd frontend
npm install
npm run build
```

## Security

Passwords, API keys, SMTP credentials, database files, generated uploads, and other production secrets must not be committed. Production administrator credentials must be supplied through protected environment variables.
