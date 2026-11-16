import React from "react";
import { Box, Toolbar } from "@mui/material";
import {
  DataGrid,
  useGridApiRef,
  GridColDef,
  GridToolbarFilterButton,
  GridRenderCellParams,
} from "@mui/x-data-grid";
import { ActionButtons } from "./ActionButtons";
import { usersService } from "../../services";
import { Role, User } from "../../types";
import { useSnackbar } from "notistack";
import { useUserDispatch, useUserState } from "../../contexts";
import { filterUsers, lastSignInLabel } from "../../_helpers/users.helper";
import { labelOf, Text, useT } from "../../i18n";

const columnsFor = (
  t: Text,
  formatDate: (value: string) => string,
): GridColDef[] => [
  {
    field: "id",
    filterable: false,
  },
  {
    field: "email",
    headerName: t("users.email"),
    flex: 2,
  },
  {
    field: "firstName",
    headerName: t("users.firstName"),
    flex: 1,
  },
  {
    field: "lastName",
    headerName: t("users.lastName"),
    flex: 1,
  },
  {
    field: "lastSignInAt",
    headerName: t("users.lastSignIn"),
    flex: 1,
    filterable: false,
    // newest first when sorted; never signed in sorts last
    valueGetter: (params) => params.row.lastSignInAt ?? "",
    renderCell: (params: GridRenderCellParams) => (
      <span data-testid="lastSignIn">
        {lastSignInLabel(params.row.lastSignInAt, formatDate)}
      </span>
    ),
  },
  {
    // the projects this person was given; an admin reaches every one (REQ-042-06)
    field: "projects",
    headerName: t("users.projects"),
    flex: 2,
    sortable: false,
    filterable: false,
    valueGetter: (params) =>
      params.row.role === "admin"
        ? t("users.allProjects")
        : (params.row.projects ?? [])
            .map((project: { name: string }) => project.name)
            .join(", ") || "—",
    renderCell: (params: GridRenderCellParams) => (
      <span data-testid="userProjects">{params.value}</span>
    ),
  },
  {
    field: "role",
    headerName: t("users.role"),
    type: "singleSelect",
    editable: true,
    valueOptions: Object.keys(Role).map((key) => ({
      value: key,
      label: labelOf(t, "role", key),
    })),
    renderCell: (params: GridRenderCellParams) => {
      const role = params.value as keyof typeof Role;
      return Role[role] ? labelOf(t, "role", role) : role;
    },
    flex: 1,
  },
];

const UserList: React.FunctionComponent<{ query?: string }> = ({
  query = "",
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const { t, formatDate } = useT();
  const columnsDef = React.useMemo(
    () => columnsFor(t, (value) => formatDate(value)),
    [t, formatDate],
  );
  const userDispatch = useUserDispatch();
  const { userList } = useUserState();

  React.useEffect(() => {
    usersService.getAll().then((users) =>
      userDispatch({
        type: "getAll",
        payload: users,
      }),
    );
  }, [userDispatch]);

  const processRowUpdate = React.useCallback(
    (newState: User, oldState: User) => {
      if (newState.role !== oldState.role) {
        usersService
          .assignRole(oldState.id, newState.role as Role)
          .then(() => {
            enqueueSnackbar(t("users.updated"), {
              variant: "success",
            });
          })
          .catch((err) =>
            enqueueSnackbar(err, {
              variant: "error",
            }),
          );
      }
      return newState;
    },
    [enqueueSnackbar, t],
  );

  const apiRef = useGridApiRef();

  return (
    <DataGrid
      apiRef={apiRef}
      rows={filterUsers(userList, query)}
      columns={columnsDef}
      columnVisibilityModel={{
        id: false,
      }}
      checkboxSelection
      disableColumnMenu
      disableRowSelectionOnClick
      slots={{
        toolbar: DataGridCustomToolbar,
      }}
      processRowUpdate={processRowUpdate}
    />
  );
};

export default UserList;

const DataGridCustomToolbar: React.FunctionComponent = () => (
  <React.Fragment>
    <Toolbar variant="dense">
      <GridToolbarFilterButton />
      <Box marginLeft="auto">
        <ActionButtons />
      </Box>
    </Toolbar>
  </React.Fragment>
);
