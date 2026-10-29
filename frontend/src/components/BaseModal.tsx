import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from "@mui/material";
import { ValidatorForm } from "react-material-ui-form-validator";
import { useT } from "../i18n";

interface IProps {
  open: boolean;
  title: string;
  content: React.ReactNode;
  submitButtonText: string;
  onSubmit: () => void;
  onCancel: () => void;
  // e.g. until a confirmation is typed in
  submitDisabled?: boolean;
}

export const BaseModal: React.FunctionComponent<IProps> = ({
  open,
  title,
  submitButtonText,
  content,
  onSubmit,
  onCancel,
  submitDisabled = false,
}) => {
  const { t } = useT();
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      aria-labelledby="form-dialog-title"
      fullWidth
    >
      <DialogTitle id="form-dialog-title">{title}</DialogTitle>
      <ValidatorForm onSubmit={onSubmit} instantValidate>
        <DialogContent>{content}</DialogContent>
        <DialogActions>
          <Button onClick={onCancel} color="primary">
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            color="primary"
            variant="contained"
            data-testid="submitButton"
            disabled={submitDisabled}
          >
            {submitButtonText}
          </Button>
        </DialogActions>
      </ValidatorForm>
    </Dialog>
  );
};
