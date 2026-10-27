import React from "react";
import {
  setProjectEditState,
  useProjectDispatch,
  useProjectState,
} from "../../contexts";
import { useT } from "../../i18n";
import { ProjectDto } from "../../types";
import { UiTreeSettings, parseUiTreeSettings } from "../../types/insights";
import { FieldError } from "./validation";

/** The project being edited on the settings page and ways to change it. */
export function useProjectDraft() {
  const { projectEditState: project } = useProjectState();
  const dispatch = useProjectDispatch();
  const settings = parseUiTreeSettings(project.uiTreeSettings);

  const update = (patch: Partial<ProjectDto>) =>
    setProjectEditState(dispatch, { ...project, ...patch });
  const updateSettings = (patch: Partial<UiTreeSettings>) =>
    update({ uiTreeSettings: JSON.stringify({ ...settings, ...patch }) });

  return { project, settings, update, updateSettings };
}

// the errors the page shows, once someone tried to save
export const FieldErrorsContext = React.createContext<FieldError[]>([]);

/** The translated error of an input, if saving found one. */
export function useFieldError(field: string): string | undefined {
  const errors = React.useContext(FieldErrorsContext);
  const { t } = useT();
  const error = errors.find((item) => item.field === field);
  return error ? t(error.message, error.params) : undefined;
}
