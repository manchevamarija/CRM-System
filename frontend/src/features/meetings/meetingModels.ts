export type AdminClient = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  organizationId?: string;
  status: string;
  roles: string[];
};

export type AdminOrganization = {
  id: string;
  name: string;
  status: string;
};
