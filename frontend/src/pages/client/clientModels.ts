export type PaymentInstructions = {
  isConfigured: boolean;
  recipient: string;
  bank: string;
  account: string;
  iban: string;
  swift: string;
  amount: string;
  currency: string;
  purpose: string;
  referenceInstruction: string;
  supportEmail: string;
};

export type AccountChangeRequest = {
  id: string;
  requestType: "Organization" | "Subscription";
  details: string;
  status: "Pending" | "Accepted" | "Declined" | "Applied";
  decisionNote?: string;
  createdAt: string;
  decidedAt?: string;
};

export type NotificationItem = {
  id: string;
  type: string;
  subject: string;
  body: string;
  actionUrl?: string | null;
  isRead: boolean;
  createdAt: string;
};

export type CrmServiceItem = {
  id: string;
  name: string;
  status: string;
  price?: number;
  deadline?: string;
  assignedAgentId?: string;
};

export type CrmRequest = {
  id: string;
  organizationName: string;
  requestType: string;
  status: string;
  assignedTo?: string;
  selectedServices?: string;
  serviceItemsJson: string;
  createdAt: string;
  updatedAt: string;
};
