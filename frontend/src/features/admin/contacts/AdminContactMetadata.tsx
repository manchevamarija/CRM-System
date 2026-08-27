import { localeFor } from "../../../content/dashboardCopy";
import { DetailRow } from "../../../pages/admin/AdminSharedComponents";
import type { Contact } from "../../../pages/admin/adminModels";
import { labelFor } from "../../../shared/labels";
import type { Language } from "../../../shared/types";

type Props = {
  contact: Contact;
  dma: Record<string, string>;
  language: Language;
  statusLabel: string;
  categoryLabel: string;
};

export function AdminContactMetadata({
  contact,
  dma,
  language,
  statusLabel,
  categoryLabel,
}: Props) {
  let selectedServices: string[] = [];
  try {
    selectedServices = contact.selectedServices
      ? JSON.parse(contact.selectedServices)
      : [];
  } catch {
    selectedServices = [];
  }

  const yesNo = (value: boolean | null | undefined) =>
    value == null ? "—" : value ? dma.yes : dma.no;

  return (
    <dl className="detail-grid">
      <DetailRow
        label="Тип на барање"
        value={
          contact.requestType === "Partnership" ? "Соработка" : "Консултација"
        }
      />
      <DetailRow label="Избрани услуги" value={selectedServices.join(", ")} />
      <DetailRow label="Ориентациски буџет" value={contact.budgetRange} />
      <DetailRow label="Даночен број" value={contact.taxNumber} />
      <DetailRow label="Матичен број" value={contact.registrationNumber} />
      <DetailRow label="Адреса" value={contact.address} />
      <DetailRow
        label={dma.type}
        value={labelFor(contact.organizationType, language)}
      />
      <DetailRow label={dma.sector} value={contact.sector} />
      <DetailRow label={dma.municipality} value={contact.municipality} />
      <DetailRow label={dma.region} value={contact.region} />
      <DetailRow label={dma.website} value={contact.website} />
      <DetailRow label={dma.employees} value={contact.employeeCount} />
      <DetailRow label={dma.fullName} value={contact.contactName} />
      <DetailRow label={dma.email} value={contact.email} />
      <DetailRow label={dma.phone} value={contact.phone} />
      <DetailRow
        label={dma.language}
        value={contact.preferredLanguage.toUpperCase()}
      />
      <DetailRow label={dma.selfRating} value={contact.digitalMaturityRating} />
      <DetailRow
        label={categoryLabel}
        value={labelFor(contact.dmaCategory, language)}
      />
      <DetailRow
        label={dma.mainNeed}
        value={labelFor(contact.mainNeed, language)}
      />
      <DetailRow label={dma.challenge} value={contact.challengeDescription} />
      <DetailRow label={dma.tools} value={contact.currentTools} />
      <DetailRow label={dma.dataSources} value={contact.currentDataSources} />
      <DetailRow label={dma.usesAi} value={yesNo(contact.usesAi)} />
      <DetailRow label={dma.useCase} value={contact.aiUseCase} />
      <DetailRow label={dma.privacyConcerns} value={contact.privacyConcerns} />
      <DetailRow
        label={dma.aiAct}
        value={yesNo(contact.interestedInAiActGuidance)}
      />
      <DetailRow label={dma.trainingNeeds} value={contact.trainingNeeds} />
      <DetailRow label={dma.timeline} value={contact.desiredTimeline} />
      <DetailRow
        label={dma.format}
        value={contact.preferredConsultationFormat}
      />
      <DetailRow label={dma.consent} value={yesNo(contact.consentToContact)} />
      <DetailRow
        label={dma.privacy}
        value={yesNo(contact.privacyPolicyAccepted)}
      />
      <DetailRow
        label={statusLabel}
        value={labelFor(contact.status, language)}
      />
      <DetailRow
        label="Креирано"
        value={new Date(contact.createdAt).toLocaleString(localeFor(language))}
      />
    </dl>
  );
}
