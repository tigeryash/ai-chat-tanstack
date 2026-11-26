import { Globe } from "lucide-react";
import { ToolTipContainer } from "./tooltip-container";

export const WebSearch = ({
	webSearchEnabled: WebSearchEnabled,
	setWebSearchEnabled,
}: {
	webSearchEnabled: boolean;
	setWebSearchEnabled: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
	return (
		<ToolTipContainer Tip="Web Search">
			<button
				type="button"
				aria-label="Web Search"
				aria-pressed={WebSearchEnabled}
				className={`input-button group flex items-center space-x-1 transition-all duration-300 ease-in-out
                ${
									WebSearchEnabled
										? "ring-success/70 ring-1 hover:text-destructive hover:bg-destructive/5! hover:ring-destructive/70! active:bg-destructive/10! active:ring-destructive/70! "
										: "hover:ring-1 hover:text-success hover:ring-success/70! hover:bg-success/10!  active:ring-2 active:ring-success/70!"
								}`}
				onClick={() => setWebSearchEnabled(!WebSearchEnabled)}
			>
				<Globe
					strokeWidth={0.75}
					size={20}
					className={`transition-colors duration-300 ease-in-out ${
						WebSearchEnabled
							? "group-hover:text-destructive text-success"
							: "group-hover:text-success"
					}`}
				/>
			</button>
		</ToolTipContainer>
	);
};
