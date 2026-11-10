/**
 * What a settings row gives its control (src/components/settings/setting-row.tsx): `controlId` for a
 * native input the row's `<label>` points at, `labelId` and `descriptionId` for `aria-labelledby` and
 * `aria-describedby` on anything else. In an inline row the control's first element sits right of the
 * label; further elements take `col-span-full` to span the row below it.
 */
export interface SettingControlProps {
	controlId: string;
	labelId: string;
	descriptionId: string;
}
