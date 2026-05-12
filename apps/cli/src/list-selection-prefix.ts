export const LIST_SELECTED_PREFIX = "› ";
export const LIST_UNSELECTED_PREFIX = "  ";

export function listSelectionPrefix(selected: boolean) {
  return selected ? LIST_SELECTED_PREFIX : LIST_UNSELECTED_PREFIX;
}
