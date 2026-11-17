import React from "react";
import { Decision } from "../../services/testRun.service";
import { DecisionKind } from "../../_helpers/undo.helper";

/**
 * Offered by a review with a queue open (064): a decision on `ids` asks
 * whether it ends the queue. True means the queue's card tells about it, so
 * the decision raises no notification of its own.
 */
export type ClaimQueueEnd = (
  ids: string[],
  kind: DecisionKind,
  decision: Decision | void,
) => boolean;

export const QueueEndContext = React.createContext<ClaimQueueEnd | null>(null);

export const useQueueEnd = () => React.useContext(QueueEndContext);
