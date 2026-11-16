import React from "react";
import { useSocketState } from "./socket.context";
import { useUserState } from "./user.context";
import type { PresenceEvent, Viewer } from "../types";
import { viewersOn } from "../_helpers/presence.helper";

const PresenceContext = React.createContext<Viewer[]>([]);

/**
 * Tells the others following the project which build and screen this tab has open, and keeps
 * who else is in the build (056). Again after every reconnect: the server forgets it.
 */
export function PresenceProvider({
  buildId,
  testRunId,
  children,
}: {
  buildId: string | null | undefined;
  testRunId: string | null | undefined;
  children: React.ReactNode;
}) {
  const { socket } = useSocketState();
  const [viewers, setViewers] = React.useState<Viewer[]>([]);

  React.useEffect(() => {
    setViewers([]);
    if (!socket || !buildId) return;
    const tell = () =>
      socket.emit("presence", { buildId, testRunId: testRunId ?? null });
    const hear = (event: PresenceEvent) => {
      if (event?.buildId === buildId) setViewers(event.viewers ?? []);
    };
    socket.on("presence", hear);
    socket.on("connect", tell);
    if (socket.connected) tell();
    return () => {
      socket.off("presence", hear);
      socket.off("connect", tell);
    };
  }, [socket, buildId, testRunId]);

  // leaving the build page takes this tab out of the build for everyone (REQ-056-02)
  React.useEffect(() => {
    if (!socket || !buildId) return;
    return () => {
      socket.emit("presence", {});
    };
  }, [socket, buildId]);

  return (
    <PresenceContext.Provider value={viewers}>
      {children}
    </PresenceContext.Provider>
  );
}

/** Colleagues who have this screen open now, without the person looking. */
export function useViewersOn(testRunId: string): Viewer[] {
  const viewers = React.useContext(PresenceContext);
  const { user } = useUserState();
  return React.useMemo(
    () => viewersOn(viewers, testRunId, user?.id),
    [viewers, testRunId, user?.id],
  );
}
