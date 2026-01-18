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
				className={`input-button group flex items-center space-x-1 transition-all duration-300 ease-in-out
                ${
									WebSearchEnabled
										? "ring-green-400/70 ring-1 hover:text-red-500 hover:bg-red-500/5! hover:ring-red-600/70! active:bg-red-500/10! active:ring-red-500/70! "
										: "hover:ring-1 hover:text-green-500 hover:ring-green-400/70! hover:bg-green-500/10!  active:ring-2 active:ring-green-500/70!"
								}`}
				onClick={() => setWebSearchEnabled(!WebSearchEnabled)}
			>
				<Globe
					strokeWidth={0.75}
					size={20}
					className={`transition-colors duration-300 ease-in-out ${
						WebSearchEnabled
							? "group-hover:text-red-500 text-green-500"
							: "group-hover:text-green-500"
					}`}
				/>
			</button>
		</ToolTipContainer>
	);
};
