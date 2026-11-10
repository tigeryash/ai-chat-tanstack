import { Link } from "@tanstack/react-router";
import type { AnchorHTMLAttributes, Ref } from "react";
import { markSettingsPushed, withSettings } from "@/lib/settings/navigation";
import type { SettingsSectionId } from "@/lib/settings/sections";

type SettingsLinkProps = Omit<
	AnchorHTMLAttributes<HTMLAnchorElement>,
	"href"
> & {
	section: SettingsSectionId;
	ref?: Ref<HTMLAnchorElement>;
};

/** A link that opens the Settings dialog over the current page, at `section`. */
export function SettingsLink({
	section,
	onClick,
	...props
}: SettingsLinkProps) {
	return (
		<Link
			{...props}
			to="."
			search={(prev) => withSettings(prev, section)}
			resetScroll={false}
			onClick={(event) => {
				markSettingsPushed();
				onClick?.(event);
			}}
		/>
	);
}
