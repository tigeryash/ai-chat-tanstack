import { AudioLines } from "@/components/animate-ui/icons/audio-lines";
import { AnimateIcon } from "@/components/animate-ui/icons/icon";
import { ToolTipContainer } from "./tooltip-container";

export const VoiceChat = () => {
	return (
		<ToolTipContainer Tip="Voice Chat">
			<AnimateIcon animateOnHover>
				<button type="button" className="input-button">
					<AudioLines size={20} strokeWidth={0.75} />
				</button>
			</AnimateIcon>
		</ToolTipContainer>
	);
};
