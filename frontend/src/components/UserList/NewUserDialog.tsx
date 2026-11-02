import React from "react";
import { MenuItem, Stack, TextField } from "@mui/material";
import { TextValidator } from "react-material-ui-form-validator";
import { useSnackbar } from "notistack";
import { BaseModal } from "../BaseModal";
import PasswordField from "../PasswordField";
import { usersService } from "../../services";
import { useUserDispatch, useUserState } from "../../contexts";
import { canCreateAccount } from "../../_helpers/users.helper";
import { NewAccount, Role } from "../../types";
import { labelOf, useT } from "../../i18n";

const EMPTY: Omit<NewAccount, "password"> = {
  email: "",
  firstName: "",
  lastName: "",
  role: "guest",
};

/** An admin creates an account and hands the password over (035). */
export const NewUserDialog: React.FunctionComponent<{
  open: boolean;
  onClose: () => void;
}> = ({ open, onClose }) => {
  const { t } = useT();
  const { enqueueSnackbar } = useSnackbar();
  const userDispatch = useUserDispatch();
  const { userList } = useUserState();
  const [account, setAccount] = React.useState(EMPTY);
  const [password, setPassword] = React.useState("");
  const update = (patch: Partial<typeof EMPTY>) =>
    setAccount((current) => ({ ...current, ...patch }));

  const close = () => {
    setAccount(EMPTY);
    setPassword("");
    onClose();
  };

  const submit = () =>
    usersService
      .create({ ...account, password })
      .then((created) => {
        userDispatch({ type: "getAll", payload: [...userList, created] });
        enqueueSnackbar(t("users.created", { email: created.email }), {
          variant: "success",
        });
        close();
      })
      .catch((err) => enqueueSnackbar(err, { variant: "error" }));

  return (
    <BaseModal
      open={open}
      title={t("users.newUser")}
      submitButtonText={t("users.create")}
      submitDisabled={!canCreateAccount({ ...account, password })}
      onCancel={close}
      onSubmit={submit}
      content={
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextValidator
            validators={["isEmail"]}
            errorMessages={[t("auth.validEmail")]}
            id="newUserEmail"
            name="email"
            label={t("users.email")}
            value={account.email}
            required
            fullWidth
            inputProps={{
              onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                update({ email: event.target.value }),
              "data-testid": "newUserEmail",
            }}
          />
          <Stack direction="row" spacing={2}>
            <TextField
              id="newUserFirstName"
              label={t("users.firstName")}
              value={account.firstName}
              onChange={(event) => update({ firstName: event.target.value })}
              inputProps={{ "data-testid": "newUserFirstName" }}
              fullWidth
            />
            <TextField
              id="newUserLastName"
              label={t("users.lastName")}
              value={account.lastName}
              onChange={(event) => update({ lastName: event.target.value })}
              inputProps={{ "data-testid": "newUserLastName" }}
              fullWidth
            />
          </Stack>
          <TextField
            select
            id="newUserRole"
            label={t("users.role")}
            value={account.role}
            onChange={(event) =>
              update({ role: event.target.value as keyof typeof Role })
            }
            SelectProps={{
              SelectDisplayProps: { "data-testid": "newUserRole" } as object,
            }}
            fullWidth
            required
          >
            {Object.keys(Role).map((key) => (
              <MenuItem key={key} value={key}>
                {labelOf(t, "role", key)}
              </MenuItem>
            ))}
          </TextField>
          <PasswordField
            password={password}
            setPassword={setPassword}
            label={t("users.password")}
          />
        </Stack>
      }
    />
  );
};
