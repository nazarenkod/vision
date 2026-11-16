import { describe, expect, it, jest } from "@jest/globals";
import type { Socket } from "socket.io-client";
import { followProject, onRejected } from "./socket.events";

// just enough of a socket.io client to fire its reserved events
const fakeSocket = (connected: boolean) => {
  const handlers = new Map<string, Set<(arg?: unknown) => void>>();
  const socket = {
    connected,
    emit: jest.fn(),
    connect: jest.fn(),
    on: (event: string, handler: (arg?: unknown) => void) => {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)?.add(handler);
      return socket;
    },
    off: (event: string, handler: (arg?: unknown) => void) => {
      handlers.get(event)?.delete(handler);
      return socket;
    },
    fire: (event: string, arg?: unknown) =>
      handlers.get(event)?.forEach((handler) => handler(arg)),
  };
  return socket as typeof socket & Socket;
};

describe("followProject", () => {
  it("subscribes to the open project at once when connected", () => {
    const socket = fakeSocket(true);
    followProject(socket, "project-a");
    expect(socket.emit).toHaveBeenCalledWith("subscribe", {
      projectId: "project-a",
    });
  });

  it("waits for the connection before subscribing", () => {
    const socket = fakeSocket(false);
    followProject(socket, "project-a");
    expect(socket.emit).not.toHaveBeenCalled();
    socket.fire("connect");
    expect(socket.emit).toHaveBeenCalledWith("subscribe", {
      projectId: "project-a",
    });
  });

  it("subscribes again after reconnecting", () => {
    const socket = fakeSocket(true);
    followProject(socket, "project-a");
    socket.fire("connect");
    expect(socket.emit).toHaveBeenCalledTimes(2);
  });

  it("stops following a project it was switched away from", () => {
    const socket = fakeSocket(true);
    const stop = followProject(socket, "project-a");
    stop();
    followProject(socket, "project-b");
    socket.fire("connect");
    expect(socket.emit).toHaveBeenLastCalledWith("subscribe", {
      projectId: "project-b",
    });
    expect(socket.emit).toHaveBeenCalledTimes(3);
  });

  it("leaves every project when none is open", () => {
    const socket = fakeSocket(true);
    followProject(socket, undefined);
    expect(socket.emit).toHaveBeenCalledWith("subscribe", { projectId: null });
  });
});

describe("onRejected", () => {
  it("signs out when the server rejects the token", () => {
    const socket = fakeSocket(false);
    const signOut = jest.fn();
    onRejected(socket, signOut);
    socket.fire("connect_error", new Error("unauthorized"));
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("keeps the user signed in when the server cannot be reached", () => {
    const socket = fakeSocket(false);
    const signOut = jest.fn();
    onRejected(socket, signOut);
    socket.fire("connect_error", new Error("xhr poll error"));
    expect(signOut).not.toHaveBeenCalled();
  });

  it("tries again when the server drops the connection", () => {
    const socket = fakeSocket(true);
    onRejected(socket, jest.fn());
    socket.fire("disconnect", "io server disconnect");
    expect(socket.connect).toHaveBeenCalledTimes(1);
  });

  it("leaves other disconnects to the automatic retries", () => {
    const socket = fakeSocket(true);
    onRejected(socket, jest.fn());
    socket.fire("disconnect", "transport close");
    socket.fire("disconnect", "io client disconnect");
    expect(socket.connect).not.toHaveBeenCalled();
  });
});
