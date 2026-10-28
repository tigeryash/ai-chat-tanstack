import { ChevronDownIcon } from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type ModelChoice, providerName } from "@/lib/chat/model-selection";
import type { HostOption } from "@/lib/hosts/host-options";
import { HostLight } from "./host-light";

// The chat header's quiet "via <host>" next to the model name (roadmap 2.2b). It becomes a switcher
// only when two or more connected hosts serve the model.

const AUTO = "auto";

function viaText(choice: ModelChoice, hosts: readonly HostOption[]): string {
	const host = providerName(choice.provider);
	if (!choice.upstream) return `via ${host}`;
	const upstream = hosts
		.find((option) => option.provider === choice.provider)
		?.upstreams?.find((entry) => entry.slug === choice.upstream);
	return `via ${host} · ${upstream?.name ?? choice.upstream}`;
}

export function HostSwitcher({
	choice,
	hosts,
	onChange,
}: {
	/** The chat's resolved choice. */
	choice: ModelChoice;
	hosts: readonly HostOption[];
	onChange: (choice: ModelChoice) => void;
}) {
	const connected = hosts.filter((option) => option.connected);
	const text = viaText(choice, hosts);
	if (connected.length < 2) {
		return <span className="text-muted-foreground text-xs">{text}</span>;
	}
	const value = choice.autoHost !== false ? AUTO : choice.provider;
	const select = (next: unknown) => {
		if (next === AUTO) {
			onChange({ ...choice, upstream: undefined, autoHost: true });
			return;
		}
		const option = connected.find((entry) => entry.provider === next);
		if (option) {
			onChange({
				provider: option.provider,
				model: option.model,
				gatewayId: choice.gatewayId,
				autoHost: false,
			});
		}
	};
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				aria-label={`Host: ${text}${value === AUTO ? " (Auto)" : ""}`}
				className="flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground text-xs hover:bg-muted"
			>
				{text}
				{value === AUTO && " (Auto)"}
				<ChevronDownIcon aria-hidden="true" className="size-3" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start">
				<DropdownMenuRadioGroup value={value} onValueChange={select}>
					<DropdownMenuRadioItem value={AUTO}>
						Auto (best connected host)
					</DropdownMenuRadioItem>
					{connected.map((option) => (
						<DropdownMenuRadioItem
							key={option.provider}
							value={option.provider}
							disabled={option.excluded !== undefined}
						>
							<HostLight state={option.health} />
							{providerName(option.provider)}
							{option.excluded && (
								<span className="text-muted-foreground text-xs">
									{option.excluded}
								</span>
							)}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
