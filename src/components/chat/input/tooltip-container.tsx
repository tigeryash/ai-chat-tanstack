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
			{/* composer-design: the tooltip keeps the composer's original colors in every theme. Radix
			    added its 10px arrow to the offset, so the tooltip sat that much above the button. */}
			<TooltipContent className="composer-design" sideOffset={10}>
				<p>{Tip}</p>
			</TooltipContent>
		</Tooltip>
	);
};
