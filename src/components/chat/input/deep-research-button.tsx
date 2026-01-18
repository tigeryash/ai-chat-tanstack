import { AtomIcon } from "@/components/ui/atom";
import { ToolTipContainer } from "./tooltip-container";

export const DeepResearch = () => {
	return (
		<ToolTipContainer Tip="Deep Research">
			<button type="button" className="input-button">
				<AtomIcon size={20} />
			</button>
		</ToolTipContainer>
	);
};
