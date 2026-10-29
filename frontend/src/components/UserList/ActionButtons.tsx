import React from "react";
import { IconButton } from "@mui/material";
import { Delete, Key } from "@mui/icons-material";
import {
  GridRowId,
  useGridApiContext,
  gridRowSelectionStateSelector,
} from "@mui/x-data-grid";
import { usersService } from "../../services";
import { useSnackbar } from "notistack";
import { useUserDispatch, useUserState } from "../../contexts";
import { Tooltip } from "../Tooltip";
import { BaseModal } from "../BaseModal";
import PasswordField from "../PasswordField";
import { useT } from "../../i18n";

export const ActionButtons: React.FunctionComponent = () => {
  const apiRef = useGridApiContext();
  const { state } = apiRef.current;
  const selection = gridRowSelectionStateSelector(state);

  const { enqueueSnackbar } = useSnackbar();
  const { t } = useT();
  const userDispatch = useUserDispatch();
  const { userList, user } = useUserState();

  const ids: GridRowId[] = React.useMemo(
    () => Object.values(selection),
    [selection],
  );
  const [passwordFor, setPasswordFor] = React.useState<string | null>(null);
  const [password, setPassword] = React.useState("");
  const passwordUser = userList.find((item) => item.id === passwordFor);

  const closePasswordDialog = () => {
    setPasswordFor(null);
    setPassword("");
  };

  return (
    <React.Fragment>
      <Tooltip title={t("users.setPasswordHelp")} aria-label="set password">
        <span>
          <IconButton
            disabled={ids.length !== 1}
            onClick={() => setPasswordFor(String(ids[0]))}
            size="large"
            data-testid="setPassword"
          >
            <Key />
          </IconButton>
        </span>
      </Tooltip>
      <BaseModal
        open={!!passwordFor}
        title={
          passwordUser
            ? t("users.setPasswordFor", { email: passwordUser.email })
            : t("users.setPasswordTitle")
        }
        submitButtonText={t("users.setPasswordTitle")}
        onCancel={closePasswordDialog}
        onSubmit={() =>
          passwordFor &&
          usersService
            .setPassword(passwordFor, password)
            .then(() => {
              enqueueSnackbar(t("users.passwordSet"), { variant: "success" });
              closePasswordDialog();
            })
            .catch((err) => enqueueSnackbar(err, { variant: "error" }))
        }
        content={
          <PasswordField
            password={password}
            setPassword={setPassword}
            label={t("users.newPassword")}
          />
        }
      />
      <Tooltip title={t("users.deleteRows")} aria-label="delete">
        <span>
          <IconButton
            disabled={!ids.length}
            onClick={() => {
              const currentUserId = user?.id;

              if (currentUserId && ids.includes(currentUserId)) {
                enqueueSnackbar(t("users.notYourself"), {
                  variant: "error",
                });
              } else {
                usersService
                  .remove(ids)
                  .then(() => {
                    enqueueSnackbar(t("users.removed"), {
                      variant: "success",
                    });
                    userDispatch({
                      type: "getAll",
                      payload: userList.filter(
                        (user) => !ids.includes(user.id),
                      ),
                    });
                  })
                  .catch((err) =>
                    enqueueSnackbar(err, {
                      variant: "error",
                    }),
                  );
              }
            }}
            size="large"
          >
            <Delete />
          </IconButton>
        </span>
      </Tooltip>
    </React.Fragment>
  );
};
