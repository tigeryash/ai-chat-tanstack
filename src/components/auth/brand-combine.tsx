import { cn } from "@/lib/utils";
import type { BrandLogo } from "./brand-logos";

/**
 * A brand's mark and name side by side. The mark is single-color until the pointer is over it, then fades to
 * the brand's colors (brands without a color logo stay as they are). With reduced motion the swap is instant
 * (the rule at the end of styles.css).
 */
export function BrandCombine({
	logo,
	size,
	className,
}: {
	logo: BrandLogo;
	size: number;
	className?: string;
}) {
	const { mono: Mono, color: Color, wordmark: Wordmark } = logo;
	const swap = "col-start-1 row-start-1 transition-opacity duration-300";

	return (
		<span
			role="img"
			aria-label={logo.title}
			className={cn("group/logo flex items-center", className)}
		>
			<span
				className="grid"
				style={{
					marginRight: Wordmark ? size * (logo.spaceMultiple ?? 0) : 0,
				}}
			>
				<span
					data-logo="mono"
					className={cn(swap, Color && "group-hover/logo:opacity-0")}
				>
					<Mono size={size} />
				</span>
				{Color && (
					<span
						data-logo="color"
						className={cn(swap, "opacity-0 group-hover/logo:opacity-100")}
					>
						<Color size={size} />
					</span>
				)}
			</span>
			{Wordmark && <Wordmark size={size * (logo.textMultiple ?? 1)} />}
		</span>
	);
}
