import { themeQuartz } from "ag-grid-community";

/** Tema de AG Grid derivado de los tokens de la aplicación.
 *  Al referenciar variables CSS, sigue al tema claro y oscuro solo. */
export const temaNordelta = themeQuartz.withParams({
  accentColor: "var(--color-brand)",
  backgroundColor: "var(--color-surface)",
  foregroundColor: "var(--color-ink)",
  borderColor: "var(--color-line-soft)",
  headerBackgroundColor: "var(--color-raised)",
  headerTextColor: "var(--color-ink-3)",
  headerFontWeight: 500,
  headerFontSize: 9.5,
  oddRowBackgroundColor: "var(--color-surface)",
  rowHoverColor: "var(--color-raised)",
  selectedRowBackgroundColor: "var(--color-brand-wash)",
  rangeSelectionBorderColor: "var(--color-brand)",
  inputFocusBorder: "1px solid var(--color-brand)",
  fontFamily: "var(--font-sans)",
  fontSize: 13,
  rowHeight: 36,
  headerHeight: 34,
  cellHorizontalPadding: 10,
  borderRadius: 0,
  wrapperBorder: false,
  wrapperBorderRadius: 0,
});
