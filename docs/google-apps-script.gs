/**
 * Google Forms -> CRM webhook.
 *
 * Setup:
 * 1. Paste this into: Google Form -> three-dot menu (⋮) -> "Script editor" (or
 *    Extensions -> Apps Script if you're viewing responses in Sheets).
 * 2. Project Settings (gear icon, left side) -> Script Properties -> Add script property:
 *    key = CRM_WEBHOOK_TOKEN, value = the same GOOGLE_FORM_WEBHOOK_SECRET from
 *    .env.production. Storing it here (instead of hard-coding it or putting it in the
 *    webhook URL) keeps the credential out of shared source and query-string logs.
 * 3. Triggers (clock icon, left side) -> Add Trigger -> function "onFormSubmitToCRM",
 *    event source "From form", event type "On form submit" -> Save.
 *
 * Reads each answer by its exact question title first (so reordering the form's
 * questions doesn't break anything). If a title ever doesn't match exactly — e.g. the
 * wording gets edited later — it silently falls back to reading that one answer by its
 * position instead, so nothing breaks silently either way. Update QUESTION_TITLES below
 * if you change the wording and want title-matching to keep working for that question.
 */
function onFormSubmitToCRM(e) {
  var CRM_WEBHOOK_URL = "https://crm.digitmak.mk/api/public/google-form-webhook";
  var TOKEN = PropertiesService.getScriptProperties().getProperty("CRM_WEBHOOK_TOKEN");
  if (!TOKEN) throw new Error("CRM_WEBHOOK_TOKEN is missing in Script Properties (Project Settings).");
  if (!e || !e.response) throw new Error("This function must run from a Google Forms submit trigger.");

  // Prevent duplicate concurrent webhook sends from Apps Script retries. The CRM is also
  // idempotent by formResponseId, so this is only a second safety layer.
  var lock = LockService.getScriptLock();
  var lockAcquired = lock.tryLock(5000);
  if (!lockAcquired) throw new Error("Could not acquire the CRM webhook lock; retrying later is safe.");

  // Exact current question titles (MK / SQ / EN combined, as Google Forms shows them).
  var QUESTION_TITLES = {
    brand: "За кој центар/сајт се однесува барањето? / Për cilën qendër/faqe është kërkesa? / Which centre/site is this request for?",
    fullName: "Име и презиме / Emri dhe mbiemri / Full name",
    email: "Email адреса / Adresa e email-it / Email address",
    phone: "Телефон / Telefoni / Phone number",
    organizationName: "Име на организација/компанија / Emri i organizatës/kompanisë / Organization/company name",
    organizationType: "Тип на организација / Lloji i organizatës / Type of organization",
    need: "Накратко опишете ја вашата потреба / Përshkruani shkurtimisht nevojën tuaj / Briefly describe your need",
    consent: "Прифатете обработка на лични податоци за контакт и обработка на барањето / Pranoni përpunimin e të dhënave personale për kontakt dhe përpunimin e kërkesës / Accept the processing of personal data for contact and request handling",
  };
  // Fallback order, used only for whichever field above doesn't match by title.
  var QUESTION_INDEX = {
    brand: 0, fullName: 1, email: 2, phone: 3,
    organizationName: 4, organizationType: 5, need: 6, consent: 7,
  };

  var answers = e.response.getItemResponses();
  var byTitle = {};
  answers.forEach(function (itemResponse) {
    byTitle[itemResponse.getItem().getTitle().trim()] = itemResponse.getResponse();
  });

  var get = function (field) {
    var title = QUESTION_TITLES[field];
    if (Object.prototype.hasOwnProperty.call(byTitle, title)) return byTitle[title];
    // Title didn't match exactly (e.g. wording changed) — fall back to position.
    var index = QUESTION_INDEX[field];
    return answers[index] ? answers[index].getResponse() : null;
  };

  var consentAnswer = get("consent");
  var consented = Array.isArray(consentAnswer) ? consentAnswer.length > 0 : Boolean(consentAnswer);

  var payload = {
    brand: get("brand"),
    fullName: get("fullName"),
    email: get("email"),
    phone: get("phone"),
    organizationName: get("organizationName"),
    organizationType: get("organizationType"),
    need: get("need"),
    consent: consented,
    formResponseId: e.response.getId(),
    submittedAt: e.response.getTimestamp().toISOString(),
  };

  try {
    var response = UrlFetchApp.fetch(CRM_WEBHOOK_URL, {
      method: "post",
      contentType: "application/json",
      headers: { "X-CRM-Webhook-Token": TOKEN },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    var code = response.getResponseCode();
    if (code < 200 || code >= 300) {
      throw new Error("CRM webhook returned HTTP " + code + ": " + response.getContentText());
    }
  } finally {
    if (lockAcquired) lock.releaseLock();
  }
}
