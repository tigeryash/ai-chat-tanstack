"use client";

import { useGSAP } from "@gsap/react";
import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";
import { gsap } from "gsap";
import { SplitText } from "gsap/all";
import { useRef } from "react";
import Models from "@/components/auth/models";
import OAuthButtons from "@/components/auth/oauthbuttons";
import Scene from "@/components/background/scene";

gsap.registerPlugin(SplitText);

const AuthLayout = () => {
	const location = useLocation();
	const pathname = location.pathname;
	const containerRef = useRef<HTMLDivElement>(null);
	useGSAP(
		() => {
			if (!containerRef.current) return;

			const subtitle = new SplitText(".subtitle", {
				type: "lines",
			});

			gsap.set(subtitle.lines, {
				y: 100,
			});
			gsap.to(subtitle.lines, {
				y: 0,
				delay: 0.3,
				duration: 1.2,
				stagger: 0.075,
				ease: "power2.inOut",
			});
			gsap.from(".auth", {
				opacity: 0,
				duration: 0.9,
				ease: "power2.inOut",
			});

			gsap.from("#footer", {
				opacity: 0,
				duration: 0.7,
				ease: "power2.in",
			});
		},
		{ dependencies: [], scope: containerRef },
	);
	return (
		<main
			ref={containerRef}
			className="flex relative flex-col-reverse items-center xl:flex-row min-h-screen xl:h-screen  overflow-hidden p-6 md:p-3 bg-slate-900"
		>
			<Scene />

			<div className="space-y-7 xl:w-full pt-10 md:pt-18 pb-12 text-gray-300 h-full flex flex-col md:rounded-2xl relative overflow-hidden">
				<Body />

				<Models />
				<Footer />
			</div>
			<div className="xl:w-1/3  md:w-[600px] lg:h-full text-white z-2 w-full p-2 lg:pl-0 auth">
				<FormContainer pathname={pathname}>
					<Outlet />
				</FormContainer>
			</div>
		</main>
	);
};

const FormContainer = ({
	pathname,
	children,
}: {
	pathname: string;
	children: React.ReactNode;
}) => {
	return (
		<div
			className="inset-shadow-lg bg-slate-300/30 flex flex-col py-10  
    items-center space-y-5 xl:space-y-10 rounded-2xl backdrop-blur-md border-[2px] lg:pt-6  lg:space-y-6 lg:h-full border-white/20"
		>
			<h2 className="text-[2.5rem] font-semibold capitalize ">
				{pathname.split("/")}
			</h2>
			{children}
			<OAuthButtons />
		</div>
	);
};

const Body = () => {
	const titleRef = useRef<HTMLDivElement>(null);
	useGSAP(
		() => {
			if (!titleRef.current) return;
			const title = new SplitText(titleRef.current, {
				type: "lines",
				mask: "lines",
			});
			gsap.set(title.lines, {
				y: 200,
			});
			gsap.to(title.lines, {
				y: 0,
				delay: 0.27,
				duration: 1.2,
				stagger: 0.03,
				ease: "power2.inOut",
			});
		},
		{ dependencies: [], scope: titleRef },
	);

	return (
		<>
			<h1
				ref={titleRef}
				className="text-4xl md:text-8xl lg:text-9xl font-bold  py-4 px-10 z-999 will-change-transform"
			>
				High ELO LLMs
			</h1>
			<p
				className="text-2xl font-semibold leading-10  lg:text-pretty px-10 subtitle"
				style={{
					clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)",
				}}
			>
				Chat with the smartest{" "}
				<span className="text-[oklch(70%.1375_229)]">AI</span> found on the of
				the{" "}
				<a
					className="hover:underline text-[oklch(70%.1375_229)]"
					href="https://lmarena.ai/leaderboard"
					target="_blank"
					rel="noopener noreferrer"
				>
					LMArena&apos;s leaderboard.{" "}
				</a>
				Built with Nextjs, TailwindCSS, Better-Auth, Convex, GSAP, React Three
				Fiber and Vercel AI SDK
			</p>
		</>
	);
};

const Footer = () => {
	return (
		<footer className="footer text-gray-300 mt-auto self-center shadow-lg bg-gray-950/10 rounded-xl py-2 px-4">
			<p>
				Project made by{" "}
				<a
					href="https://github.com/tigeryash"
					target="_blank"
					rel="noopener noreferrer"
					className="hover:underline"
				>
					Yash
				</a>
			</p>
		</footer>
	);
};

export const Route = createFileRoute("/(auth)")({
	component: AuthLayout,
});
