import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/tooltip";

export const ToolTipContainer = ({
	children,
	Tip,
}: {
	children: React.ReactNode;
	Tip: string;
}) => {
	return (
		<Tooltip>
			<TooltipTrigger asChild>{children}</TooltipTrigger>
			<TooltipContent>
				<p>{Tip}</p>
			</TooltipContent>
		</Tooltip>
	);
};
