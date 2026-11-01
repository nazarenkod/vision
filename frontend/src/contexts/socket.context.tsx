import * as React from "react";
import socketIOClient, { Socket } from "socket.io-client";
import {
  useBuildState,
  useBuildDispatch,
  addBuild,
  updateBuild,
} from "./build.context";
import { Build, TestRun } from "../types";
import {
  useTestRunDispatch,
  addTestRun,
  updateTestRun,
  deleteTestRun,
} from "./testRun.context";
import { API_URL } from "../_config/env.config";
import { useProjectState } from "./project.context";
import { useUserState } from "./user.context";
import { logoutAndReload } from "../_helpers/service.helpers";
import { followProject, onRejected } from "./socket.events";

interface IConnectAction {
  type: "connect";
  payload: Socket;
}

interface IClearAction {
  type: "clear";
}

type IAction = IConnectAction | IClearAction;
type Dispatch = (action: IAction) => void;
type State = {
  socket: Socket | undefined;
};
type SocketProviderProps = {
  children: React.ReactNode;
};

const SocketStateContext = React.createContext<State | undefined>(undefined);
const SocketDispatchContext = React.createContext<Dispatch | undefined>(
  undefined,
);

const initialState: State = {
  socket: undefined,
};

function socketReducer(state: State, action: IAction): State {
  switch (action.type) {
    case "connect":
      return {
        socket: action.payload,
      };

    case "clear":
      return {
        socket: undefined,
      };

    default:
      return state;
  }
}

function SocketProvider({ children }: SocketProviderProps) {
  const [state, dispatch] = React.useReducer(socketReducer, initialState);
  const { selectedBuild } = useBuildState();
  const { selectedProjectId } = useProjectState();
  const testRunDispatch = useTestRunDispatch();
  const buildDispatch = useBuildDispatch();
  const { user } = useUserState();
  const token = user?.token;

  // Only a signed-in user gets events (spec 032): a new login token means a
  // new connection, signing out closes it.
  React.useEffect(() => {
    if (!token) {
      return;
    }
    const socket = connect(dispatch, token);
    const stopRejected = socket && onRejected(socket, logoutAndReload);
    return () => {
      stopRejected?.();
      socket?.close();
      dispatch({ type: "clear" });
    };
  }, [token]);

  React.useEffect(() => {
    if (state.socket) {
      return followProject(state.socket, selectedProjectId);
    }
  }, [state.socket, selectedProjectId]);

  React.useEffect(() => {
    if (state.socket) {
      // by name: connect, connect_error and disconnect have handlers of their own
      LIVE_EVENTS.forEach((event) => state.socket?.off(event));

      state.socket.on("build_created", function (build: Build) {
        if (build.projectId === selectedProjectId) {
          addBuild(buildDispatch, build);
        }
      });

      state.socket.on("build_updated", function (builds: Build[]) {
        updateBuild(
          buildDispatch,
          builds.filter((build) => build.projectId === selectedProjectId),
        );
      });

      state.socket.on("build_deleted", function (build: Build) {
        buildDispatch({
          type: "delete",
          payload: build.id,
        });
      });

      state.socket.on("testRun_created", function (testRuns: TestRun[]) {
        if (!selectedBuild) {
          return;
        }

        // events for other builds arrive too — an empty dispatch would still
        // replace the (possibly huge) testRuns array and re-render the grid
        const created = testRuns.filter(
          (tr) => tr.buildId === selectedBuild.id,
        );
        if (created.length === 0) {
          return;
        }

        addTestRun(testRunDispatch, created);
      });

      state.socket.on("testRun_updated", function (testRuns: TestRun[]) {
        if (!selectedBuild) {
          return;
        }

        const updated = testRuns.filter(
          (tr) => tr.buildId === selectedBuild.id,
        );
        if (updated.length === 0) {
          return;
        }

        updateTestRun(testRunDispatch, updated);
      });

      state.socket.on("testRun_deleted", function (testRuns: TestRun[]) {
        if (!selectedBuild) {
          return;
        }

        const deleted = testRuns
          .filter((tr) => tr.buildId === selectedBuild.id)
          .map((testRun) => testRun.id);
        if (deleted.length === 0) {
          return;
        }

        deleteTestRun(testRunDispatch, deleted);
      });
    }
  }, [
    state.socket,
    selectedBuild,
    selectedProjectId,
    buildDispatch,
    testRunDispatch,
  ]);

  return (
    <SocketStateContext.Provider value={state}>
      <SocketDispatchContext.Provider value={dispatch}>
        {children}
      </SocketDispatchContext.Provider>
    </SocketStateContext.Provider>
  );
}

function useSocketState() {
  const context = React.useContext(SocketStateContext);

  if (context === undefined) {
    throw Error("must be used within a SocketProvider");
  }

  return context;
}

function useSocketDispatch() {
  const context = React.useContext(SocketDispatchContext);

  if (context === undefined) {
    throw Error("must be used within a SocketProvider");
  }

  return context;
}

const LIVE_EVENTS = [
  "build_created",
  "build_updated",
  "build_deleted",
  "testRun_created",
  "testRun_updated",
  "testRun_deleted",
];

function connect(dispatch: Dispatch, token: string): Socket | undefined {
  if (API_URL) {
    const socket = socketIOClient(API_URL, { auth: { token } });
    dispatch({
      type: "connect",
      payload: socket,
    });
    return socket;
  }
}

export { SocketProvider, useSocketState, useSocketDispatch, connect };
