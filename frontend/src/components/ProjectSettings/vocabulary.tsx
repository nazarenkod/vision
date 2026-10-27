import React from "react";
import { insightsService } from "../../services";
import { ProjectVocabulary } from "../../types/insights";

export interface VocabularyState {
  vocabulary: ProjectVocabulary | null;
  loading: boolean;
}

export const VocabularyContext = React.createContext<VocabularyState>({
  vocabulary: null,
  loading: false,
});

/** The project's vocabulary, read once the first tab that needs it opens. */
export function useLoadVocabulary(
  projectId: string | undefined,
  needed: boolean,
): VocabularyState {
  const [state, setState] = React.useState<VocabularyState>({
    vocabulary: null,
    loading: false,
  });
  const requested = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!projectId || !needed || requested.current === projectId) return;
    requested.current = projectId;
    setState({ vocabulary: null, loading: true });
    insightsService
      .getProjectVocabulary(projectId)
      .then((vocabulary) => setState({ vocabulary, loading: false }))
      // without suggestions every field still takes typed values
      .catch(() => setState({ vocabulary: null, loading: false }));
  }, [projectId, needed]);

  return state;
}

export const useVocabulary = () => React.useContext(VocabularyContext);

/** Whether there is anything to suggest from. */
export const hasSuggestions = (vocabulary: ProjectVocabulary | null) =>
  !!vocabulary && vocabulary.trees > 0;
