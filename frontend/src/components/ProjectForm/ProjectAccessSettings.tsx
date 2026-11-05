import React from "react";
import {
  Autocomplete,
  Box,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemText,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { PersonRemoveOutlined } from "@mui/icons-material";
import { useSnackbar } from "notistack";
import { projectsService, usersService } from "../../services";
import { ProjectMember, User } from "../../types";
import { labelOf, useT } from "../../i18n";
import { tokens } from "../../theme";

const nameOf = (person: {
  firstName?: string | null;
  lastName?: string | null;
  email: string;
}) =>
  [person.firstName, person.lastName].filter(Boolean).join(" ") || person.email;

/**
 * Who sees and works in the project (042): an admin gives and takes access here, and it applies
 * from the next request. Admins are not listed: they reach every project.
 */
export const ProjectAccessSettings: React.FunctionComponent<{
  projectId: string;
}> = ({ projectId }) => {
  const { t } = useT();
  const { enqueueSnackbar } = useSnackbar();
  const [members, setMembers] = React.useState<ProjectMember[]>();
  const [people, setPeople] = React.useState<User[]>([]);
  const [picked, setPicked] = React.useState<User | null>(null);

  React.useEffect(() => {
    projectsService
      .getAccess(projectId)
      .then(setMembers)
      .catch((err) => enqueueSnackbar(err, { variant: "error" }));
    usersService
      .getAll()
      .then(setPeople)
      .catch(() => setPeople([]));
  }, [projectId, enqueueSnackbar]);

  const given = new Set(members?.map((member) => member.userId));
  const choices = people.filter(
    (person) => person.role !== "admin" && !given.has(person.id),
  );

  const change = (next: Promise<ProjectMember[]>, done: string) =>
    next
      .then((updated) => {
        setMembers(updated);
        enqueueSnackbar(done, { variant: "success" });
      })
      .catch((err) => enqueueSnackbar(err, { variant: "error" }));

  return (
    <Box
      data-testid="projectAccess"
      sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}
    >
      <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
        <Autocomplete
          size="small"
          sx={{ flex: 1, maxWidth: 420 }}
          options={choices}
          value={picked}
          onChange={(_, value) => setPicked(value)}
          getOptionLabel={(person) => `${nameOf(person)} · ${person.email}`}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          renderInput={(params) => (
            <TextField
              {...params}
              label={t("access.pick")}
              inputProps={{ ...params.inputProps, "data-testid": "accessPick" }}
            />
          )}
        />
        <Button
          variant="outlined"
          disabled={!picked}
          data-testid="accessAdd"
          onClick={() => {
            if (!picked) return;
            change(
              projectsService.grantAccess(projectId, picked.id),
              t("access.added", { name: nameOf(picked) }),
            ).then(() => setPicked(null));
          }}
        >
          {t("access.add")}
        </Button>
      </Box>
      {members && !members.length && (
        <Typography variant="body2" sx={{ color: tokens.textSecondary }}>
          {t("access.none")}
        </Typography>
      )}
      {!!members?.length && (
        <List dense disablePadding data-testid="accessList">
          {members.map((member) => (
            <ListItem
              key={member.userId}
              disableGutters
              secondaryAction={
                <Tooltip title={t("access.remove")}>
                  <IconButton
                    edge="end"
                    aria-label={t("access.removeOf", {
                      name: nameOf(member),
                    })}
                    onClick={() =>
                      change(
                        projectsService.revokeAccess(projectId, member.userId),
                        t("access.removed", { name: nameOf(member) }),
                      )
                    }
                  >
                    <PersonRemoveOutlined fontSize="small" />
                  </IconButton>
                </Tooltip>
              }
            >
              <ListItemText
                primary={nameOf(member)}
                secondary={`${member.email} · ${labelOf(t, "role", member.role)}`}
              />
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
};
