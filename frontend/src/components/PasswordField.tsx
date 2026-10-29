import React, { useState } from "react";
import { IconButton, InputAdornment } from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { TextValidator } from "react-material-ui-form-validator";
import { useT } from "../i18n";

interface PasswordFieldProps {
  password: string;
  setPassword: React.Dispatch<React.SetStateAction<string>>;
  label?: string;
}

const PasswordField = ({
  password,
  setPassword,
  label,
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

  return (
    <TextValidator
      validators={["minStringLength:2"]}
      errorMessages={[errorForTwoChar]}
      id="password"
      name="password"
      value={password}
      label={label ?? t("profile.password")}
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
};

export default PasswordField;
