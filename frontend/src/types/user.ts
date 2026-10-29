export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  token: number;
  apiKey: string;
  role: keyof typeof Role;
  // the last sign-in to the web interface; null: not signed in since it is kept
  lastSignInAt?: string | null;
  // personal Jira credentials: the token itself never comes back from the server
  jiraTokenSet?: boolean;
  jiraEmail?: string | null;
}

export enum Role {
  admin = "Admin",
  editor = "Editor",
  guest = "Guest",
}
