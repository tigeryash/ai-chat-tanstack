import type { ComponentType } from "react";
import {
	AccentColorControl,
	AdvancedColorsControl,
	CodeFontSelect,
	CodeThemeSelect,
	DensityChoice,
	PresetChoice,
	RadiusChoice,
	ReadingFontSelect,
	ReadingWidthChoice,
	ResetAppearance,
	TextSize,
	ThemeChoice,
	ThemeFileControl,
	UiFontSelect,
} from "@/components/appearance/appearance-settings";
import type { SettingId } from "@/lib/settings/registry";
import {
	ProfileControl,
	SignInMethods,
	SignOutControl,
	SignOutRemoveChatsControl,
} from "./account-settings";
import { AnalyticsSwitch, LegalLinks } from "./analytics-settings";
import {
	NotificationPermission,
	NotifyFailedSwitch,
	NotifyFinishedSwitch,
	TabStatusSwitch,
	TestNotification,
} from "./background-status-settings";
import { ContextWarningsSwitch } from "./chat-settings";
import { ConnectOpenRouter } from "./connect-openrouter";
import { DataTransfer } from "./data-settings";
import { DefaultModelControl, TitleModelControl } from "./general-settings";
import {
	BlockedHostsControl,
	MinPrecisionSelect,
	PriceCapControl,
} from "./host-preferences";
import { LocalEndpoints } from "./local-endpoints";
import { ProviderKeyList } from "./provider-keys";
import type { SettingControlProps } from "./setting-row-props";

/** The control for each row of the settings registry (`src/lib/settings/registry.ts`). */
export const SETTING_CONTROLS: Record<
	SettingId,
	ComponentType<SettingControlProps>
> = {
	"default-model": DefaultModelControl,
	"title-model": TitleModelControl,
	"blocked-hosts": BlockedHostsControl,
	"min-precision": MinPrecisionSelect,
	"price-cap": PriceCapControl,
	"connect-openrouter": () => <ConnectOpenRouter />,
	"provider-keys": ProviderKeyList,
	"local-endpoints": LocalEndpoints,
	preset: PresetChoice,
	theme: ThemeChoice,
	density: DensityChoice,
	radius: RadiusChoice,
	"reading-width": ReadingWidthChoice,
	"accent-color": AccentColorControl,
	"advanced-colors": AdvancedColorsControl,
	"text-size": TextSize,
	"ui-font": UiFontSelect,
	"reading-font": ReadingFontSelect,
	"code-font": CodeFontSelect,
	"code-theme": CodeThemeSelect,
	"theme-file": ThemeFileControl,
	"reset-appearance": ResetAppearance,
	"context-warnings": ContextWarningsSwitch,
	"tab-status": TabStatusSwitch,
	"notify-finished": NotifyFinishedSwitch,
	"notify-failed": NotifyFailedSwitch,
	"notification-permission": NotificationPermission,
	"test-notification": TestNotification,
	"export-import": DataTransfer,
	analytics: AnalyticsSwitch,
	legal: LegalLinks,
	profile: ProfileControl,
	"sign-in-methods": SignInMethods,
	"sign-out": SignOutControl,
	"sign-out-remove-chats": SignOutRemoveChatsControl,
};
