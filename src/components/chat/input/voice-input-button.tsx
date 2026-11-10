import { MicIcon } from "@/components/ui/mic";
import { ToolTipContainer } from "./tooltip-container";

export const VoiceInput = () => {
	return (
		<ToolTipContainer Tip="Voice Input">
			<button type="button" aria-label="Voice Input" className="input-button">
				<MicIcon size={20} />
			</button>
		</ToolTipContainer>
	);
};
