export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  token: number;
  apiKey: string;
  role: keyof typeof Role;
  // personal Jira credentials: the token itself never comes back from the server
  jiraTokenSet?: boolean;
  jiraEmail?: string | null;
}

export enum Role {
  admin = "Admin",
  editor = "Editor",
  guest = "Guest",
}
