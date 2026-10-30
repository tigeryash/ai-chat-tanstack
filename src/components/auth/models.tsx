"use client";

import { useRef, useState } from "react";
import {
	Marquee,
	MarqueeContent,
	MarqueeItem,
} from "@/components/ui/shadcn-io/marquee";
import { useLazyGsap } from "@/lib/lazy-gsap";
import { FULL_MOTION, usePrefersReducedMotion } from "@/lib/reduced-motion";
import { BrandCombine } from "./brand-combine";
import { brandLogos } from "./brand-logos";

const modelLogos = [
	brandLogos.openai,
	brandLogos.claude,
	brandLogos.gemini,
	brandLogos.deepseek,
	brandLogos.qwen,
	brandLogos.grok,
	brandLogos.kimi,
	brandLogos.zai,
	brandLogos.meta,
];

const Models = () => {
	const containerRef = useRef<HTMLDivElement>(null);
	const [speed, setSpeed] = useState(500);
	// A scrolling strip is motion too: with reduced motion it stands still.
	const reduceMotion = usePrefersReducedMotion();
	useLazyGsap(({ gsap }) => {
		if (!containerRef.current) return;
		const container = containerRef.current;
		gsap.matchMedia().add(FULL_MOTION, () => {
			const speedObj = { speed: 500 };
			gsap.set(container, {
				opacity: 0,
			});
			gsap.to(container, {
				opacity: 1,
				delay: 1,
				duration: 1.5,
				ease: "power2.inOut",
			});
			gsap.to(speedObj, {
				delay: 1.7,
				speed: 70,
				duration: 1.5,
				ease: "power2.out",
				onUpdate: () => {
					setSpeed(speedObj.speed);
				},
			});
		});
	}, containerRef);
	return (
		<div
			ref={containerRef}
			className="flex items-center justify-center max-w-screen mt-16"
		>
			<Marquee className="w-full  ">
				<MarqueeContent
					pauseOnHover={true}
					play={!reduceMotion}
					className=""
					speed={speed}
					direction="left"
				>
					{modelLogos.map((logo) => (
						<MarqueeItem key={logo.title}>
							<BrandCombine logo={logo} size={80} />
						</MarqueeItem>
					))}
				</MarqueeContent>
			</Marquee>
		</div>
	);
};

export default Models;
