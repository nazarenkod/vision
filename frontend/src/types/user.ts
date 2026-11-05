export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  token: string;
  // the API key itself is shown once, when it is made (044); afterwards only its ending
  apiKeyEnding?: string | null;
  role: keyof typeof Role;
  // the last sign-in to the web interface; null: not signed in since it is kept
  lastSignInAt?: string | null;
  // personal Jira credentials: the token itself never comes back from the server
  jiraTokenSet?: boolean;
  jiraEmail?: string | null;
  // a personal Gemini key for drafting bugs with AI (025): only whether one is set
  geminiKeySet?: boolean;
  // the projects this person was given, on the admin's Users page (042)
  projects?: Array<{ id: string; name: string }>;
}

// what an admin fills in to create an account (035)
export interface NewAccount {
  email: string;
  firstName: string;
  lastName: string;
  role: keyof typeof Role;
  password: string;
}

export enum Role {
  admin = "Admin",
  editor = "Editor",
  guest = "Guest",
}
