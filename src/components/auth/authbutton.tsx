import { Image } from "@unpic/react";
import { cn } from "@/lib/utils";

const AuthButton = ({
	Icon,
	image,
	name,
	className,
	onClick,
}: {
	Icon?: (props: { size: number }) => React.ReactElement;
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
				"py-2.5 px-4 rounded-lg border border-input bg-background/40 flex items-center gap-2 hover:bg-accent w-full justify-center",
				" hover:text-accent-foreground transition-all duration-300 hover:scale-[1.02] text-base overflow-hidden cursor-pointer focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
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
