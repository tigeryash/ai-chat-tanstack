import { type BrandLogo, brandLogos } from "@/components/auth/brand-logos";
import { developerName } from "@/lib/models/developers";
import { cn } from "@/lib/utils";

// A developer's mark for the model picker and card (roadmap 2.2), from the brand SVGs the auth pages
// use. Developers without one get their initial.

const DEVELOPER_LOGOS: Record<string, BrandLogo> = {
	openai: brandLogos.openai,
	anthropic: brandLogos.claude,
	google: brandLogos.gemini,
	deepseek: brandLogos.deepseek,
	alibaba: brandLogos.qwen,
	xai: brandLogos.grok,
	spacexai: brandLogos.grok,
	moonshotai: brandLogos.kimi,
	zai: brandLogos.zai,
	meta: brandLogos.meta,
};

export function ModelLogo({
	developer,
	size = 16,
	className,
}: {
	/** Gateway developer id, or "local". */
	developer: string;
	size?: number;
	className?: string;
}) {
	const logo = DEVELOPER_LOGOS[developer];
	const Mark = logo?.color ?? logo?.mono;
	return (
		<span
			aria-hidden="true"
			className={cn(
				"inline-flex shrink-0 items-center justify-center",
				!Mark &&
					"rounded-sm bg-muted font-medium text-[0.65rem] text-muted-foreground uppercase",
				className,
			)}
			style={{ width: size, height: size }}
		>
			{Mark ? <Mark size={size} /> : developerName(developer).charAt(0)}
		</span>
	);
}
