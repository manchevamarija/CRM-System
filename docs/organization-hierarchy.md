# Organization hierarchy & partner-to-organization linking

Organizations can now have a parent organization (e.g. a chamber like BAU with member
companies such as "Стопанска комора" as sub-organizations underneath it), and a
registered affiliate partner (`/bau/stopanska-komora`) can be connected to a specific CRM
organization so leads arriving through that link land there automatically.

## Organization hierarchy

- `Organization.ParentOrganizationId` — optional, self-referencing. Set from the
  Organizations admin tab: each organization row has a "parent" dropdown; picking one
  updates it immediately (`PUT /api/admin/organizations/{id}/parent`). Circular
  hierarchies (A → B → A) are rejected server-side.
- The create-organization form also lets you pick a parent up front.
- **Moving a client between organizations**: in an organization's member list, each
  member has a "Transfer to…" dropdown + button (`POST
  /api/admin/organizations/transfer-client`). This only changes their current
  organization membership — their contact request/meeting/ticket history is untouched.

## Partner → organization linking

`AffiliatePartner.LinkedOrganizationId` connects a registered partner (brand + partner
code) to a specific CRM organization. Set it either when registering a new partner (the
"CRM организација" dropdown in the partner form), or afterward from the partner
breakdown table (`PUT /api/admin/affiliate/partners/{id}/organization`).

When a lead arrives through that partner's link (via the Google Form webhook or the
CRM's own contact form) and doesn't already resolve to an organization by email/name
match, `ContactRequestService.CreateAsync` automatically sets `LinkedOrganizationId` to
the partner's linked organization — no manual "Поврзи со организација" step needed for
that lead. A direct email/name match always takes priority over the partner link.

## Client self-registration and duplicate prevention

Filling the Google Form (or the CRM's own contact form) never creates a login account —
only a `ContactRequest` (a lead visible in the admin Contacts tab). No password is ever
generated or emailed from that step.

Two ways a client later gets full portal access:

1. **Admin sends an invite**: the "Испрати мejл за регистрација" button on a contact
   request (`POST /api/admin/contact-requests/{id}/invite-registration`) emails a
   registration link that includes `contactRequestId` and the email, e.g.
   `.../register?contactRequestId=<id>&email=<email>`. Landing on `/register` this way
   pre-fills the email and skips the usual email-verification wait, since an admin has
   already confirmed the person by phone/email.
2. **Self-service**: the client goes to `/register` directly and signs up with their own
   password, same as any new visitor.

Either way, registration never creates a second `ContactRequest`. `POST /api/auth/register`
looks up every existing `ContactRequest` with no `UserId` yet that matches the new
account's email and links them to the new account instead of leaving them orphaned or
duplicating them.

## Brand-scoped staff visibility

`AppUser.AssignedBrand` restricts a staff/admin account (Admin, HelpDeskAgent, Expert
roles) to seeing only Contact Requests attributed to that one brand (`digitmak`,
`vezilka`, `hpc`, `bau`) in the admin Contacts list. Set it from the Users admin tab —
each staff member with one of those roles has a "Гледа само:" dropdown. Leaving it on
"Сите брендови" (the default for every existing account) keeps them seeing everything,
so this is fully backward compatible.

`PlatformAdmin` always sees every brand regardless of this setting. Requests with no
`AffiliateCode` (submitted through the plain `/contact` form, not an affiliate link)
count as the deployment's own default brand (`BRAND_ID` in `.env.production`).

This scoping currently applies to the Contact Requests list only
(`AdminContactRequestsController.Get`) — Meetings, Tickets, and Organizations lists are
not yet brand-scoped the same way.

## Client-side notification history

Notifications sent before a person has a CRM account (the initial contact confirmation,
a registration invite) are addressed by `RecipientEmail` only, since there's no
`RecipientUserId` yet. When that person later registers, `POST /api/auth/register` now
also back-fills `RecipientUserId` on any matching un-owned notifications by email, so
they show up in that person's own in-app notification bell (`GET /api/notifications/mine`)
retroactively, not just in their inbox.
