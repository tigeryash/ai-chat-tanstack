import { createLocalStore } from "@/lib/local-store";
import { z } from "@/lib/zod";
import { PICKER_VIEWS, type PickerView } from "./picker-filter";

// The picker's High Elo / All / Local switch, remembered in this browser so local-model users don't
// have to switch every time.

export const PICKER_VIEW_KEY = "highelo-picker-view";

const view = createLocalStore<PickerView>(
	PICKER_VIEW_KEY,
	z.enum(PICKER_VIEWS),
	"high-elo",
);

export function usePickerView() {
	return [view.use(), view.write] as const;
}
