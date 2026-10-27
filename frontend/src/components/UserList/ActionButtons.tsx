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

export const ActionButtons: React.FunctionComponent = () => {
  const apiRef = useGridApiContext();
  const { state } = apiRef.current;
  const selection = gridRowSelectionStateSelector(state);

  const { enqueueSnackbar } = useSnackbar();
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
      <Tooltip
        title="Set a password for the selected user (after a restore, people have none)."
        aria-label="set password"
      >
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
        title={`Set password${passwordUser ? ` for ${passwordUser.email}` : ""}`}
        submitButtonText="Set password"
        onCancel={closePasswordDialog}
        onSubmit={() =>
          passwordFor &&
          usersService
            .setPassword(passwordFor, password)
            .then(() => {
              enqueueSnackbar("Password set", { variant: "success" });
              closePasswordDialog();
            })
            .catch((err) => enqueueSnackbar(err, { variant: "error" }))
        }
        content={
          <PasswordField
            password={password}
            setPassword={setPassword}
            label="New password"
          />
        }
      />
      <Tooltip title="Delete selected rows." aria-label="delete">
        <span>
          <IconButton
            disabled={!ids.length}
            onClick={() => {
              const currentUserId = user?.id;

              if (currentUserId && ids.includes(currentUserId)) {
                enqueueSnackbar(`You cannot delete yourself.`, {
                  variant: "error",
                });
              } else {
                usersService
                  .remove(ids)
                  .then(() => {
                    enqueueSnackbar(`Removed`, {
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
