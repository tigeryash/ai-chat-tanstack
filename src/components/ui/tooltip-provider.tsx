import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";

// Its own module so the root route, which renders it on every page, doesn't also load the tooltip
// popup and positioning code in `tooltip.tsx` (quality audit P1).
export function TooltipProvider({
	delay = 0,
	...props
}: TooltipPrimitive.Provider.Props) {
	return (
		<TooltipPrimitive.Provider
			data-slot="tooltip-provider"
			delay={delay}
			{...props}
		/>
	);
}
