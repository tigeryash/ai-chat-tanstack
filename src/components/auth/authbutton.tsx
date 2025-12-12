import { Image } from "@unpic/react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const AuthButton = ({
	Icon,
	image,
	name,
	className,
	onClick,
}: {
	Icon?: LucideIcon;
	image?: string;
	name: string;
	className?: string;
	onClick?: () => void;
}) => {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"py-3 px-4 rounded-xl border border-white/70 flex items-center gap-2 hover:bg-white w-full justify-center",
				" hover:text-black transition-all duration-300 hover:scale-105 hover:shadow-lg hover:border-white text-lg overflow-hidden cursor-pointer",
				className,
			)}
		>
			{Icon && <Icon size={22} />}
			{image && <Image src={image} alt="" width={20} height={20} />}
			<p className="hidden md:block">{name}</p>
		</button>
	);
};

export default AuthButton;
