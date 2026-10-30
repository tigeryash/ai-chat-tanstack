"use client";

import {
	CatchBoundary,
	ClientOnly,
	createFileRoute,
	Link,
	Outlet,
	redirect,
	useLocation,
} from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { LINK_CLASS } from "@/components/auth/auth-form";
import Models from "@/components/auth/models";
import OAuthButtons from "@/components/auth/oauthbuttons";
import { loadGsap, useLazyGsap } from "@/lib/lazy-gsap";
import { logError } from "@/lib/log";
import { FULL_MOTION } from "@/lib/reduced-motion";

// Start fetching GSAP now, alongside hydration, so the reveals below rarely wait for it.
if (typeof window !== "undefined") {
	void loadGsap().catch(() => {
		// useLazyGsap reports it if the reveals can't run.
	});
}

// three.js and React Three Fiber are most of this route's JavaScript. Loading the background after
// hydration keeps them off the critical path, so the form works before the scene arrives.
const Scene = lazy(() => import("@/components/background/scene"));

const AuthLayout = () => {
	const location = useLocation();
	const pathname = location.pathname;
	const containerRef = useRef<HTMLDivElement>(null);
	// `data-hydrated` tells e2e tests when the forms handle submits themselves. A parent's effect runs
	// after its children's, so the form below is hydrated by then too.
	const [hydrated, setHydrated] = useState(false);
	useEffect(() => setHydrated(true), []);
	useLazyGsap(({ gsap, SplitText }) => {
		if (!containerRef.current) return;

		gsap.matchMedia().add(FULL_MOTION, () => {
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

			gsap.from(".footer", {
				opacity: 0,
				duration: 0.7,
				ease: "power2.in",
			});
		});
	}, containerRef);
	return (
		<main
			ref={containerRef}
			data-hydrated={hydrated}
			className="dark flex relative flex-col-reverse items-center xl:flex-row min-h-screen xl:h-screen  overflow-hidden p-6 md:p-3 bg-auth-backdrop text-foreground"
		>
			<ClientOnly>
				{/* The scene is decoration: if it can't load or WebGL is missing, show the plain background. */}
				<CatchBoundary
					getResetKey={() => "scene"}
					errorComponent={() => null}
					onCatch={(error) => logError("Background scene failed", error)}
				>
					<Suspense fallback={null}>
						<Scene />
					</Suspense>
				</CatchBoundary>
			</ClientOnly>

			<div className="space-y-7 xl:w-full pt-10 md:pt-18 pb-12 text-foreground/85 h-full flex flex-col md:rounded-2xl relative overflow-hidden">
				<Body />

				<Models />
				<Footer />
			</div>
			<div className="xl:w-1/3  md:w-[600px] lg:h-full text-foreground z-2 w-full p-2 lg:pl-0 auth">
				<FormContainer pathname={pathname}>
					<Outlet />
				</FormContainer>
			</div>
		</main>
	);
};

const PAGE_TITLES: Record<string, string> = {
	"/login": "Sign in",
	"/signup": "Sign up",
	"/forgot-password": "Forgot password",
	"/reset-password": "Reset password",
};

const pageTitle = (pathname: string) =>
	PAGE_TITLES[pathname.replace(/\/+$/, "")] ?? "Welcome";

const FormContainer = ({
	pathname,
	children,
}: {
	pathname: string;
	children: React.ReactNode;
}) => {
	return (
		<div
			className="bg-card/85 text-card-foreground flex flex-col py-10
    items-center space-y-5 xl:space-y-10 rounded-pane backdrop-blur-md border lg:pt-6  lg:space-y-6 lg:h-full border-border"
		>
			<h2 className="text-3xl font-semibold tracking-tight">
				{pageTitle(pathname)}
			</h2>
			{/* No login wall (decision 4): an account is only for the cloud features. */}
			<p className="px-8 text-center text-muted-foreground">
				Sign in to sync and share. Chatting doesn't need an account: your keys
				and chats stay in this browser.{" "}
				<Link to="/new" className={LINK_CLASS}>
					Continue without an account
				</Link>
			</p>
			{children}
			<OAuthButtons />
		</div>
	);
};

const Body = () => {
	const titleRef = useRef<HTMLDivElement>(null);
	useLazyGsap(({ gsap, SplitText }) => {
		if (!titleRef.current) return;
		const titleElement = titleRef.current;
		gsap.matchMedia().add(FULL_MOTION, () => {
			const title = new SplitText(titleElement, {
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
		});
	}, titleRef);

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
				Chat with the smartest <span className="text-link">AI</span> found on
				the of the{" "}
				<a
					className="hover:underline text-link"
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
		<footer className="footer text-foreground/85 mt-auto self-center shadow-lg bg-overlay/10 rounded-xl py-2 px-4">
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
				{" · "}
				<Link to="/privacy" className="hover:underline">
					Privacy
				</Link>
				{" · "}
				<Link to="/terms" className="hover:underline">
					Terms
				</Link>
			</p>
		</footer>
	);
};

export const Route = createFileRoute("/(auth)")({
	// Every page here is for signed-out visitors: login, sign-up, forgot and reset password.
	beforeLoad: ({ context }) => {
		if (context.isAuthenticated) {
			throw redirect({ to: "/new" });
		}
	},
	component: AuthLayout,
});
