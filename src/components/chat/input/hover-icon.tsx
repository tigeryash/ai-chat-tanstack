import { m, type Variants } from "motion/react";

// What the composer's icons do while their button is hovered. The button sets `whileHover="hover"`
// and the variant reaches this span. Both are transforms, which the root MotionConfig makes instant
// under reduced motion, so they don't play there (hard rule 3).
const animations = {
	// The plane flies off to the top right and comes back in from the bottom left.
	send: {
		rest: { x: 0, y: 0, scale: 1 },
		hover: {
			scale: [1, 0.8, 1, 1, 1],
			x: [0, "-10%", "100%", "-125%", 0],
			y: [0, "10%", "-100%", "125%", 0],
			transition: {
				duration: 1.2,
				ease: "easeInOut",
				times: [0, 0.25, 0.5, 0.5, 1],
			},
		},
	},
	// The paperclip wiggles.
	attach: {
		rest: { rotate: 0 },
		hover: {
			rotate: [0, -18, 12, -6, 0],
			transition: { duration: 0.8, ease: "easeInOut" },
		},
	},
} satisfies Record<string, Variants>;

export const HoverIcon = ({
	animation,
	children,
}: {
	animation: keyof typeof animations;
	children: React.ReactNode;
}) => (
	// The plane is clipped at the icon's edge, like the SVG it replaces was.
	<span className={animation === "send" ? "block overflow-hidden" : "block"}>
		<m.span className="block" variants={animations[animation]}>
			{children}
		</m.span>
	</span>
);
