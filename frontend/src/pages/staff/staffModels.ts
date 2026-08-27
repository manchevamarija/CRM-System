export type StaffUser = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
};

export type StaffContact = {
  id: string;
  organizationName: string;
  contactName: string;
  email: string;
  dmaCategory: string;
  mainNeed: string;
  status: string;
  linkedOrganizationId?: string;
};

export type StaffOrganizationDetail = {
  organization: {
    id: string;
    name: string;
    type: string;
    sector?: string;
    municipality?: string;
    region?: string;
    website?: string;
    employeeCount?: number;
    status: string;
  };
  members: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber?: string;
    isPrimaryContact: boolean;
  }[];
};
