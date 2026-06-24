export const LIST_SELECTED_PREFIX = "› ";
export const LIST_UNSELECTED_PREFIX = "  ";

export const listSelectionPrefix = (selected: boolean) =>
  selected ? LIST_SELECTED_PREFIX : LIST_UNSELECTED_PREFIX;
