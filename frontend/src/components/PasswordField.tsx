import React, { useState } from "react";
import { IconButton, InputAdornment } from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { TextValidator } from "react-material-ui-form-validator";
import { useT } from "../i18n";
import { MIN_PASSWORD_LENGTH } from "../_helpers/users.helper";
import { FieldLabel } from "./FieldLabel";

interface PasswordFieldProps {
  password: string;
  setPassword: React.Dispatch<React.SetStateAction<string>>;
  label?: string;
  // a password being set, not typed to sign in: 12 characters or more (045)
  isNew?: boolean;
  // the label above the field instead of inside it (spec 046)
  labelAbove?: boolean;
  helperText?: string;
  size?: "small" | "medium";
}

const PasswordField = ({
  password,
  setPassword,
  label,
  isNew = false,
  labelAbove = false,
  helperText,
  size,
}: PasswordFieldProps) => {
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const handleClickShowPassword = () => setShowPassword((show) => !show);

  const handleMouseDownPassword = (
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault();
  };

  const { t } = useT();
  const errorForTwoChar = t("validation.twoCharacters");

  const shownLabel = label ?? t("profile.password");
  const field = (
    <TextValidator
      validators={[`minStringLength:${isNew ? MIN_PASSWORD_LENGTH : 2}`]}
      errorMessages={[
        isNew
          ? t("validation.passwordLength", { count: MIN_PASSWORD_LENGTH })
          : errorForTwoChar,
      ]}
      id="password"
      name="password"
      value={password}
      label={labelAbove ? undefined : shownLabel}
      helperText={helperText}
      size={size}
      type={showPassword ? "text" : "password"}
      InputProps={{
        endAdornment: (
          <InputAdornment position="end">
            <IconButton
              aria-label={t("profile.togglePassword")}
              onClick={handleClickShowPassword}
              onMouseDown={handleMouseDownPassword}
              edge="end"
            >
              {showPassword ? <VisibilityOff /> : <Visibility />}
            </IconButton>
          </InputAdornment>
        ),
      }}
      variant="outlined"
      required
      fullWidth
      inputProps={{
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          setPassword(event.target.value),
        "data-testid": "password",
      }}
    />
  );
  return labelAbove ? (
    <div>
      <FieldLabel htmlFor="password">{shownLabel}</FieldLabel>
      {field}
    </div>
  ) : (
    field
  );
};

export default PasswordField;
