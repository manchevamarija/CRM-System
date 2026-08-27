import type { Language } from "../../shared/types";

export type Kpis = {
  activeSubscriptions: number;
  expiredSubscriptions: number;
  aiHelpDeskSubscriptions: number;
  tickets: number;
  newTickets: number;
  meetings: number;
  confirmedMeetings: number;
  contactRequests: number;
  publicInstitutions: number;
  aiActRequests: number;
  referrals: number;
  repeatClients: number;
};
export type Organization = {
  id: string;
  name: string;
  type: string;
  region?: string;
  status: string;
};
export type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  organizationId?: string;
  status: "PendingVerification" | "Active" | "Inactive";
  emailVerifiedAt?: string;
  preferredLanguage: string;
  phoneNumber?: string;
  createdAt: string;
  updatedAt: string;
  roles: string[];
};
export type Subscription = {
  id: string;
  userId: string;
  organizationId: string;
  status: string;
  expiresAt?: string;
};
export type SubscriptionInvitation = {
  id: string;
  userId: string;
  organizationId: string;
  status: string;
  expiresAt: string;
  createdAt: string;
};
export type AccountChangeRequest = {
  id: string;
  userId: string;
  organizationId: string;
  requestType: "Organization" | "Subscription";
  details: string;
  status: "Pending" | "Accepted" | "Declined";
  decisionNote?: string;
  createdAt: string;
  email: string;
  firstName: string;
  lastName: string;
};
export type StaffUser = { id: string; email: string; role: string };
export type AdminNotification = {
  id: string;
  recipientUserId?: string;
  recipientEmail?: string;
  type: string;
  language?: string;
  subject: string;
  status: string;
  attemptCount: number;
  nextAttemptAt?: string;
  lastError?: string;
  sentAt?: string;
  createdAt: string;
};
export type MyNotification = {
  id: string;
  type: string;
  subject: string;
  body: string;
  actionUrl?: string | null;
  isRead: boolean;
  createdAt: string;
};
export type Contact = {
  id: string;
  createdTenantId: string;
  ownerTenantId: string;
  ownershipTransferredAt?: string;
  requestType: "Consultation" | "Partnership";
  organizationName: string;
  organizationType: string;
  contactName: string;
  email: string;
  dmaCategory: string;
  mainNeed: string;
  status: string;
  assignedTo?: string;
  assignedHelpDeskAdvisorId?: string;
  assignedExpertId?: string;
  linkedOrganizationId?: string;
  sector?: string;
  municipality?: string;
  region?: string;
  website?: string;
  taxNumber?: string;
  registrationNumber?: string;
  address?: string;
  phone?: string;
  preferredLanguage: string;
  employeeCount?: number;
  digitalMaturityRating?: number;
  challengeDescription: string;
  currentTools?: string;
  currentDataSources?: string;
  usesAi?: boolean;
  aiUseCase?: string;
  privacyConcerns?: string;
  interestedInAiActGuidance: boolean;
  trainingNeeds?: string;
  desiredTimeline?: string;
  preferredConsultationFormat?: string;
  selectedServices?: string;
  serviceItemsJson: string;
  budgetRange?: string;
  internalNote?: string;
  consentToContact: boolean;
  privacyPolicyAccepted: boolean;
  createdAt: string;
};
export type TenantDescriptor = {
  id: string;
  name: string;
  legalName: string;
  supportEmail: string;
  primaryColor: string;
  accentColor: string;
};
export type ContactRequestTransfer = {
  id: string;
  contactRequestId: string;
  fromTenantId: string;
  toTenantId: string;
  reason: string;
  transferredAt: string;
};
export type CrmServiceItem = {
  id: string;
  name: string;
  status: string;
  price?: number;
  deadline?: string;
  assignedAgentId?: string;
};
export type Audit = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
};
export type Setting = {
  id: string;
  key: string;
  value: string;
  description?: string;
};
export type ContentItem = {
  id: string;
  slug: string;
  status: string;
  category?: string;
  createdAt: string;
  updatedAt: string;
};
export type ContentTranslation = {
  entityId: string;
  language: "mk" | "en" | "sq";
  fieldName: string;
  value: string;
};
export type ContentCollection = {
  items: ContentItem[];
  translations: ContentTranslation[];
};
export type Ticket = {
  id: string;
  ticketNumber: string;
  organizationId: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  assignedAgentId?: string;
  assignedExpertId?: string;
  createdAt: string;
  updatedAt: string;
  finalRecommendation?: string;
  referralRecommendation?: string;
};
export type AdminAttachment = {
  id: string;
  ticketId: string;
  messageId?: string;
  fileId: string;
  uploadedBy: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  checksum: string;
  ticketNumber: string;
  ticketTitle: string;
  organizationName: string;
  sourceType?: string;
  createdAt: string;
};
export type Evidence = {
  id: string;
  relatedEntityType: string;
  relatedEntityId: string;
  fileId: string;
  kpiCategory?: string;
  reportingPeriod?: string;
  templateType?: string;
  createdAt: string;
};
export type EvidenceTarget = { id: string; label: string };
export type CountGroup = { key: string; count: number };
export type ContactReport = {
  byOrganizationType: CountGroup[];
  bySector: CountGroup[];
  byRegion: CountGroup[];
  byNeed: CountGroup[];
  byDmaCategory: CountGroup[];
};
export type CrmDemandReport = {
  byService: CountGroup[];
  byClient: CountGroup[];
};
export type CrmAnalyticsReport = {
  byMonth: CountGroup[];
  byCrmStage: CountGroup[];
  byRequestType: CountGroup[];
  byBudget: CountGroup[];
  byServiceStatus: CountGroup[];
  byAgent: CountGroup[];
  overdueServices: number;
  upcomingDeadlines: number;
  totalQuotedValue: number;
  averageServiceValue: number;
  conversionRate: number;
  completionRate: number;
};
export type TicketReport = {
  byCategory: CountGroup[];
  byStatus: CountGroup[];
  byAssignee: CountGroup[];
  byOrganizationType: CountGroup[];
};
export type MeetingReport = { byStatus: CountGroup[]; byType: CountGroup[] };
export type EvidenceTemplate = {
  id: string;
  code: string;
  name: string;
  relatedEntityType: string;
  description?: string;
  requiredMetadataJson: string;
  isActive: boolean;
};

export const evidenceTemplateMk: Record<
  string,
  { title: string; description: string }
> = {
  "TICKET-RESOLUTION": {
    title: "Затворање тикет и конечна препорака",
    description:
      "Образец за документирање на дадената поддршка и конечниот исход од тикетот.",
  },
  "MEETING-DELIVERY": {
    title: "Одржан консултативен состанок",
    description:
      "Евиденција за потврден или завршен состанок, учесници и договорени резултати.",
  },
  "SUBSCRIPTION-KPI": {
    title: "Активна годишна претплата",
    description:
      "Образец за евиденција на активирана лична претплата и периодот на важност.",
  },
  "CONTACT-INTAKE": {
    title: "Прием и обработка на контакт-барање",
    description:
      "Евиденција за организацијата, потребата и начинот на кој е обработено јавното барање.",
  },
  "KPI-PERIOD": {
    title: "KPI досие за извештаен период",
    description:
      "Основен образец за показател, вредност, извор и одобрување во избраниот период.",
  },
  "KPI-CONTACT-BREAKDOWN": {
    title: "Преглед на контакт-барања",
    description:
      "Контактите групирани по сектор, регион, тип на организација и DMA потреба.",
  },
  "KPI-TICKET-BREAKDOWN": {
    title: "Преглед на тикети за поддршка",
    description:
      "Тикетите групирани по категорија, статус, приоритет, одговорно лице и организација.",
  },
  "KPI-MEETING-REFERRAL": {
    title: "Состаноци и упатувања",
    description:
      "Завршени консултации и упатувања подготвени за програмско известување.",
  },
  "KPI-SUBSCRIPTION-COHORT": {
    title: "Преглед на претплати",
    description:
      "Поканети, активирани, истечени и откажани претплати за избраниот период.",
  },
};

export const evidenceTemplateView = (
  item: EvidenceTemplate,
  language: Language,
) =>
  language === "mk" && evidenceTemplateMk[item.code]
    ? evidenceTemplateMk[item.code]
    : { title: item.name, description: item.description ?? "" };
export type OrgDetail = {
  organization: Organization;
  members: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    memberStatus: string;
  }[];
};
