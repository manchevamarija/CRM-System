# Affiliate marketing (Google Form combination)

Each brand's plain affiliate link opens the same public page, with the shared Google Form
embedded directly inside it (an iframe) — the visitor stays on the CRM's own domain the
whole time, they're never sent away to a separate Google page. The form itself is
unchanged and contains no partner question; the CRM tracks brand + partner separately.

## Affiliate URLs

- `/digitmak`, `/hpc`, `/vezilka`, `/bau` — brand-level links
- `/digitmak/acme-agency` (etc.) — partner-level links, open-ended partner slug

Visiting any of these (`AffiliateGoogleFormPage.tsx`):
1. Fires `POST /api/public/affiliate/click` with the brand and partner — this is what
   powers the click counts in the admin "Партнерски линкови" tab, per brand and per
   partner. The resulting `clickId` is kept in `localStorage` (per brand+partner, 30 days)
   so a returning visitor doesn't get double-counted.
2. Renders the Google Form in an iframe, with that brand pre-selected via a
   pre-filled-link parameter (`entry.<id>=<BRAND NAME>`).

Plain `/contact` (no brand in the URL) still shows the CRM's own built-in form, unchanged.

Note: this deliberately does **not** try to detect a successful submission from the
iframe reloading. Google Forms is cross-origin and can navigate/reload the embedded
document for reasons unrelated to a successful submit, so an iframe `load` event is not
a trustworthy signal on its own — using it would risk showing an inflated, misleading
"submitted" count in the admin overview. The only authoritative signal that a lead was
actually created is the Google Form webhook itself (below).

## The Google Form

Form: `https://docs.google.com/forms/d/e/1FAIpQLSfSUlJVyKm46FSXymdM_Hg_nEkFwg8B6ZvDLcsQb0zTjz4z9A/viewform`

Its first question ("За кој центар/сајт се однесува барањето?") is a required
multiple-choice with options BAU / DIGITMAK / VEZILKA / HPC — that question's field id is
`entry.1452035505`, hardcoded as the default for `VITE_GOOGLE_FORM_BRAND_ENTRY_ID` in
`AffiliateGoogleFormPage.tsx` (settable at build time via that env var without a code
change). If the form is ever rebuilt from scratch (not just edited), that field id can
change — get the new one from Google Form → ⋮ → "Get pre-filled link".

The form itself only asks for the brand, not the specific partner. Partner-level
attribution for an actual lead is recovered server-side instead: when the webhook
(below) receives a submission, it looks at that brand's clicks from the last 30 minutes
that haven't already produced a lead, and picks the one closest in time to the
submission — but only when it is clearly the best match (more than two minutes closer
than the next-best candidate). If several candidate clicks are too close together to
distinguish safely, no partner is attributed rather than risking the wrong one. Once a
click is used this way, its `ConvertedAt` timestamp is set — this is what powers the
admin overview's "Пополнети форми" number, and it is only ever set after a real lead has
been created, never guessed from the browser.

## Getting responses back into the CRM

A Google Apps Script (`docs/google-apps-script.gs` in this repo) is bound to the form and
runs on every new submission. It posts the answer to
`POST /api/public/google-form-webhook`, with the shared secret sent as an
`X-CRM-Webhook-Token` header (not a URL parameter, so it never ends up in a server access
log). The endpoint validates that header, resolves the brand against the tenant directory,
and creates a normal `ContactRequest` (same admin views, same email confirmation) with
`AffiliateCode` set to that brand. See the script file for the exact setup steps (Script
editor → paste → store the token in Script Properties → add an "On form submit" trigger).
For backwards compatibility the endpoint still also accepts the older `?token=...` query
parameter form, but the header is what the current script uses.

The script reads each answer by its exact current question title first (the titles are
hardcoded in the script, matching the form as of this writing) — this means reordering
the form's questions doesn't break anything. If a title ever stops matching exactly (the
question's wording gets edited later), that one field quietly falls back to reading by
position instead, so a wording change never silently loses a field — it just stops being
reorder-proof for that one question until the hardcoded title is updated to match.

`GOOGLE_FORM_WEBHOOK_SECRET` is generated automatically by `deploy/setup-production.ps1`
and required by `deploy/validate-production.sh`/`.ps1`. Put the same value into the Apps
Script's Script Properties as `CRM_WEBHOOK_TOKEN` (Project Settings → Script Properties →
Add script property) — not typed directly into the script body, so it stays out of the
visible source if the script is ever shared.

## Admin

Administrators have a **Партнерски линкови** tab with: total clicks, form submissions
(counted only once a lead is actually created via the webhook — see above, never
guessed from the browser), leads, served requests, conversion rate; a brand-level
breakdown (all four brands always shown, even with zero traffic); a partner-level
breakdown fed by both real clicks and registered partners (`AffiliatePartner`, manageable
from this tab — register a partner before it has any traffic and its link still shows
up); and copyable links for each brand and partner. Contact request cards and request
details display the affiliate source; CRM report exports include the affiliate brand and
partner columns.

All admin affiliate endpoints require the `Admin` policy.

## Production host

Production is deployed on a single public host: `https://crm.digitmak.mk`. Affiliate
brand/partner links are path-based under that host; separate `crm.hpc.mk`,
`crm.vezilka.mk`, or `crm.bau.mk` hosts are not required for the current shared
deployment.
