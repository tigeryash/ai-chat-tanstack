import type { ComponentType } from "react";
import {
	AccentColorControl,
	AdvancedColorsControl,
	CodeFontSelect,
	DensityChoice,
	ReadingFontSelect,
	ResetAppearance,
	TextSize,
	ThemeChoice,
	ThemeFileControl,
	UiFontSelect,
} from "@/components/appearance/appearance-settings";
import type { SettingId } from "@/lib/settings/registry";
import { AnalyticsSwitch, LegalLinks } from "./analytics-settings";
import {
	NotificationPermission,
	NotifyFailedSwitch,
	NotifyFinishedSwitch,
	TabStatusSwitch,
	TestNotification,
} from "./background-status-settings";
import { ConnectOpenRouter } from "./connect-openrouter";
import { DataTransfer } from "./data-settings";
import { LocalEndpoints } from "./local-endpoints";
import { ProviderKeyList } from "./provider-keys";
import type { SettingControlProps } from "./setting-row-props";

/** The control for each row of the settings registry (`src/lib/settings/registry.ts`). */
export const SETTING_CONTROLS: Record<
	SettingId,
	ComponentType<SettingControlProps>
> = {
	"connect-openrouter": () => <ConnectOpenRouter />,
	"provider-keys": ProviderKeyList,
	"local-endpoints": LocalEndpoints,
	theme: ThemeChoice,
	density: DensityChoice,
	"accent-color": AccentColorControl,
	"advanced-colors": AdvancedColorsControl,
	"text-size": TextSize,
	"ui-font": UiFontSelect,
	"reading-font": ReadingFontSelect,
	"code-font": CodeFontSelect,
	"theme-file": ThemeFileControl,
	"reset-appearance": ResetAppearance,
	"tab-status": TabStatusSwitch,
	"notify-finished": NotifyFinishedSwitch,
	"notify-failed": NotifyFailedSwitch,
	"notification-permission": NotificationPermission,
	"test-notification": TestNotification,
	"export-import": DataTransfer,
	analytics: AnalyticsSwitch,
	legal: LegalLinks,
};
