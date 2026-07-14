export interface AuthContext {
  bearerToken: string;
  userId: string;
  userName: string;
  userEmail: string;
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
  role: string;
}
