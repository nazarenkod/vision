import React from "react";
import { TextField, TextFieldProps } from "@mui/material";
import { parseLocaleNumber, useT } from "../../i18n";

type Props = Omit<TextFieldProps, "value" | "onChange"> & {
  value: number | null | undefined;
  // NaN for text that is not a number, so validation can say so
  onChange: (value: number | null) => void;
  // an empty field means null instead of NaN
  allowEmpty?: boolean;
};

/** A number typed with a comma or a point, shown as the language writes it. */
export const NumberField: React.FunctionComponent<Props> = ({
  value,
  onChange,
  allowEmpty,
  ...props
}) => {
  const { formatNumber } = useT();
  const shown = (number: number | null | undefined) =>
    number === null || number === undefined || Number.isNaN(number)
      ? ""
      : formatNumber(number).replace(/\s/g, "");
  const [text, setText] = React.useState(shown(value));

  // follow changes from outside (a reset), but not the ones typed here
  React.useEffect(() => {
    const typed = text.trim() === "" ? null : parseLocaleNumber(text);
    const same =
      typed === value ||
      (typeof typed === "number" &&
        typeof value === "number" &&
        Number.isNaN(typed) &&
        Number.isNaN(value));
    if (!same) setText(shown(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <TextField
      size="small"
      {...props}
      value={text}
      inputProps={{ inputMode: "decimal", ...props.inputProps }}
      onChange={(event) => {
        setText(event.target.value);
        const next = event.target.value;
        onChange(
          next.trim() === "" && allowEmpty ? null : parseLocaleNumber(next),
        );
      }}
    />
  );
};
