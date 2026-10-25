"use client";

import { motion } from "motion/react";
import {
	type CSSProperties,
	type ElementType,
	type JSX,
	memo,
	useMemo,
} from "react";
import { usePrefersReducedMotion } from "@/lib/reduced-motion";
import { cn } from "@/lib/utils";

export type TextShimmerProps = {
	children: string;
	as?: ElementType;
	className?: string;
	duration?: number;
	spread?: number;
};

const ShimmerComponent = ({
	children,
	as: Component = "p",
	className,
	duration = 2,
	spread = 2,
}: TextShimmerProps) => {
	const reduceMotion = usePrefersReducedMotion();
	const MotionComponent = motion.create(
		Component as keyof JSX.IntrinsicElements,
	);

	const dynamicSpread = useMemo(
		() => (children?.length ?? 0) * spread,
		[children, spread],
	);

	// The root MotionConfig only stops position and size animations, and this loops
	// backgroundPosition, so with reduced motion the text stands still in the shimmer's base color.
	if (reduceMotion) {
		// Not every intrinsic tag takes these props (React Three Fiber adds three.js ones), so narrow `as`.
		const StillComponent = Component as ElementType<{
			className: string;
			children: string;
		}>;
		return (
			<StillComponent
				className={cn("relative inline-block text-muted-foreground", className)}
			>
				{children}
			</StillComponent>
		);
	}

	return (
		<MotionComponent
			animate={{ backgroundPosition: "0% center" }}
			className={cn(
				"relative inline-block bg-[length:250%_100%,auto] bg-clip-text text-transparent",
				"[--bg:linear-gradient(90deg,#0000_calc(50%-var(--spread)),var(--color-background),#0000_calc(50%+var(--spread)))] [background-repeat:no-repeat,padding-box]",
				className,
			)}
			initial={{ backgroundPosition: "100% center" }}
			style={
				{
					"--spread": `${dynamicSpread}px`,
					backgroundImage:
						"var(--bg), linear-gradient(var(--color-muted-foreground), var(--color-muted-foreground))",
				} as CSSProperties
			}
			transition={{
				repeat: Number.POSITIVE_INFINITY,
				duration,
				ease: "linear",
			}}
		>
			{children}
		</MotionComponent>
	);
};

export const Shimmer = memo(ShimmerComponent);
