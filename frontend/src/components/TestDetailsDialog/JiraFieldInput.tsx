import React from "react";
import { Autocomplete, MenuItem, TextField } from "@mui/material";
import { insightsService } from "../../services";
import { JiraBugInput, JiraUser } from "../../types";
import { useT } from "../../i18n";

/** A chosen value in Jira's create form, with the text to show for it. */
export interface ChosenValue {
  value: unknown;
  display: string;
}

const userRef = (user: JiraUser) =>
  user.accountId
    ? { accountId: user.accountId }
    : { name: user.name ?? user.key };

const optionIds = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.map((item) => String((item as { id: string }).id))
    : value && typeof value === "object" && "id" in value
      ? [String((value as { id: string }).id)]
      : [];

/** One field of a Jira bug: a person, an option, several options, or text. */
export const JiraFieldInput: React.FunctionComponent<{
  testRunId: string;
  input: JiraBugInput;
  chosen?: ChosenValue;
  onChange: (value: ChosenValue | undefined) => void;
}> = ({ testRunId, input, chosen, onChange }) => {
  const value = chosen?.value ?? input.value;
  const { t } = useT();
  const label = `${input.name}${input.required ? " *" : ""}`;
  const [query, setQuery] = React.useState("");
  const [people, setPeople] = React.useState<JiraUser[]>([]);
  const [searching, setSearching] = React.useState(false);

  React.useEffect(() => {
    if (input.type !== "user" || query.trim().length < 2) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const found = await insightsService.findJiraUsers(
          testRunId,
          query.trim(),
        );
        if (!cancelled) setPeople(found);
      } catch {
        if (!cancelled) setPeople([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [input.type, query, testRunId]);

  if (input.type === "user") {
    const current: JiraUser | null =
      value && typeof value === "object"
        ? {
            ...(value as JiraUser),
            displayName: chosen?.display ?? input.display ?? "",
          }
        : null;
    return (
      <Autocomplete
        options={people}
        value={current}
        filterOptions={(options) => options}
        loading={searching}
        getOptionLabel={(user) =>
          user.displayName ?? user.name ?? user.accountId ?? ""
        }
        isOptionEqualToValue={(a, b) =>
          (a.accountId ?? a.name) === (b.accountId ?? b.name)
        }
        onInputChange={(_, text, reason) =>
          reason === "input" && setQuery(text)
        }
        onChange={(_, user) =>
          onChange(
            user
              ? { value: userRef(user), display: user.displayName ?? "" }
              : undefined,
          )
        }
        noOptionsText={t(
          query.trim().length < 2 ? "bug.typeName" : "bug.nobody",
        )}
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            placeholder={t("bug.searchByName")}
          />
        )}
      />
    );
  }

  if (input.type === "option" || input.type === "options") {
    const multiple = input.type === "options";
    const ids = optionIds(value);
    return (
      <TextField
        select
        label={label}
        value={multiple ? ids : (ids[0] ?? "")}
        SelectProps={{ multiple }}
        onChange={(event) => {
          const picked = ([] as string[]).concat(
            event.target.value as string | string[],
          );
          const options = (input.options ?? []).filter((option) =>
            picked.includes(option.id),
          );
          onChange(
            options.length
              ? {
                  value: multiple
                    ? options.map((option) => ({ id: option.id }))
                    : { id: options[0].id },
                  display: options.map((option) => option.label).join(", "),
                }
              : undefined,
          );
        }}
      >
        {(input.options ?? []).map((option) => (
          <MenuItem key={option.id} value={option.id}>
            {option.label}
          </MenuItem>
        ))}
      </TextField>
    );
  }

  return (
    <TextField
      label={label}
      type={input.type === "number" ? "number" : "text"}
      value={value === undefined || value === null ? "" : String(value)}
      onChange={(event) => {
        const text = event.target.value;
        onChange(
          text === ""
            ? undefined
            : {
                value: input.type === "number" ? Number(text) : text,
                display: text,
              },
        );
      }}
    />
  );
};
