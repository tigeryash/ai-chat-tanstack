import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/tooltip";

export const ToolTipContainer = ({
	children,
	Tip,
}: {
	/** One element; Base UI's `render` makes it the trigger, like Radix's `asChild` did. */
	children: React.ReactElement;
	Tip: string;
}) => {
	return (
		<Tooltip>
			<TooltipTrigger render={children} />
			<TooltipContent>
				<p>{Tip}</p>
			</TooltipContent>
		</Tooltip>
	);
};
