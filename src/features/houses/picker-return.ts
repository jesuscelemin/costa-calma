// Whether the visitor reached a house page from the landing's selection of house types, in this
// page load. «Volver a las casas» then goes back through the history, so the browser restores the
// landing where it was; otherwise (a direct link, a reload) it navigates to the selection.

let chosenFromPicker: string | null = null;

/** Notes that the visitor chose this house type on the selection. */
export function rememberPickerChoice(slug: string) {
  chosenFromPicker = slug;
}

/** Whether the visitor came to this house type's page from the selection. */
export function cameFromPicker(slug: string) {
  return chosenFromPicker === slug;
}
