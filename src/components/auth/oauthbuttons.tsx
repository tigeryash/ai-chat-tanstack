"use client";
import { useRef } from "react";
import AuthButton from "./authbutton";
import { Google } from "@lobehub/icons";
import { Github } from "@lobehub/icons";
import DiscordIcon from "../../../../public/discord-icon.svg";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { authClient } from "@/lib/auth-client";


const OAuthButtons = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      gsap.fromTo(
        ".auth-button > button",
        {
          opacity: 0,
          y: -180,
        },
        {
          opacity: 1,
          y: 0,
          stagger: 0.1,
          duration: 0.3,
          ease: "power2.inOut",
          delay: 0.12,
        }
      );
    },
    { scope: containerRef }
  );

  const handleProviderSignIn = async (provider: string) => {
    await authClient.signIn.social({
      provider: provider as "google" | "github" | "discord"
    });
  };

  return (
    <>
      <div className="relative w-full flex items-center justify-center px-4 space-x-1">
        <div className="bg-white/70 h-[.5px] w-[85%]  " />
        <div className="text-nowrap text-white/90">or sign in with</div>
        <div className="bg-white/70 h-[.5px] w-[85%] " />
      </div>
      <div
        ref={containerRef}
        className="md:grid md:grid-cols-3 flex items-center gap-1 w-full px-3"
      >
        <div className="auth-button">
          <AuthButton
            Icon={Google}
            name="google"
            onClick={() => handleProviderSignIn("google")}
          />
        </div>
        <div className="auth-button ">
          <AuthButton
            Icon={Github}
            name="github"
            onClick={() => handleProviderSignIn("github")}
          />
        </div>
        <div className="auth-button ">
          <AuthButton
            image={DiscordIcon}
            name="discord"
            onClick={() => handleProviderSignIn("discord")}
          />
        </div>
      </div>
    </>
  );
};

export default OAuthButtons;
