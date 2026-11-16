/** A colleague in the same build, and the screen they have open (056). */
export interface Viewer {
  userId: string;
  name: string;
  testRunId: string | null;
}

export interface PresenceEvent {
  buildId: string;
  viewers: Viewer[];
}
