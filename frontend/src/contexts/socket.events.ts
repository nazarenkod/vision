import type { Socket } from "socket.io-client";

// What the server answers in connect_error to a missing, forged or expired
// login token (spec 032).
export const UNAUTHORIZED = "unauthorized";

type EventsSocket = Pick<
  Socket,
  "connected" | "emit" | "on" | "off" | "connect"
>;

// Subscribes to the open project now and after every reconnect: the server
// forgets subscriptions together with the connection.
export function followProject(
  socket: EventsSocket,
  projectId: string | null | undefined,
): () => void {
  const subscribe = () => {
    socket.emit("subscribe", { projectId: projectId ?? null });
  };
  if (socket.connected) {
    subscribe();
  }
  socket.on("connect", subscribe);
  return () => {
    socket.off("connect", subscribe);
  };
}

export function onRejected(
  socket: EventsSocket,
  onUnauthorized: () => void,
): () => void {
  const onError = (error: Error) => {
    if (error.message === UNAUTHORIZED) {
      onUnauthorized();
    }
  };
  // The server drops a connection whose token expired, and socket.io does not
  // retry after that by itself. Trying again either passes with a newer token
  // or is rejected, which signs out like a 401 from the API.
  const onDisconnect = (reason: Socket.DisconnectReason) => {
    if (reason === "io server disconnect") {
      socket.connect();
    }
  };
  socket.on("connect_error", onError);
  socket.on("disconnect", onDisconnect);
  return () => {
    socket.off("connect_error", onError);
    socket.off("disconnect", onDisconnect);
  };
}
