import { Loader2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimateIcon } from "@/components/animate-ui/icons/icon";
import { Paperclip } from "@/components/animate-ui/icons/paperclip";
import type { FileObject } from "@/lib/attachments/file-object";
import { ToolTipContainer } from "./tooltip-container";

export const Files = ({
	files,
	onRemove,
}: {
	files: FileObject[];
	onRemove: (id: string) => void;
}) => {
	const [selected, setSelected] = useState<FileObject | null>(null);

	if (files.length === 0) return null;

	return (
		<>
			<div className="relative flex flex-nowrap gap-2 w-full  px-4 py-2 overflow-x-auto z-10 ">
				<AnimatePresence mode="popLayout">
					{files.map((file) => (
						<motion.div
							layout
							initial={{ opacity: 0, scale: 0.8, x: 50 }}
							animate={{ opacity: 1, scale: 1, x: 0 }}
							exit={{ opacity: 0, scale: 0.8, x: -20 }}
							transition={{ duration: 0.3 }}
							key={file.id}
							className="relative group bg-black/5  rounded-lg p-2 flex shrink-0 items-center space-x-2 border border-black/10"
						>
							<FileThumbnail file={file} onOpen={() => setSelected(file)} />
							<div className="flex flex-col">
								<span className="text-xs max-w-[100px] truncate">
									{file.file.name}
								</span>
								<p className="text-xs">
									{(file.file.size / (1024 * 1024)).toFixed(2)} MB
								</p>
							</div>

							<button
								type="button"
								onClick={() => onRemove(file.id)}
								aria-label={`Remove ${file.file.name}`}
								className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600
                             text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-all shadow-sm z-30"
							>
								<X size={12} />
							</button>
						</motion.div>
					))}
				</AnimatePresence>
			</div>
			{selected && (
				<ImagePreview file={selected} onClose={() => setSelected(null)} />
			)}
		</>
	);
};

const FileThumbnail = ({
	file,
	onOpen,
}: {
	file: FileObject;
	onOpen: () => void;
}) => {
	if (!file.preview) {
		return (
			<div className="w-10 h-10 bg-blue-100 flex items-center justify-center rounded text-[10px] font-bold">
				{file.file.name.split(".").pop()?.toUpperCase()}
			</div>
		);
	}
	return (
		<button
			type="button"
			className="relative shrink-0 focus:outline-none"
			onClick={onOpen}
			disabled={file.isProcessing}
			aria-label={`Preview ${file.file.name}`}
		>
			<img
				src={file.preview}
				alt=""
				className={`w-10 h-10 object-cover rounded ${file.isProcessing ? "opacity-50" : ""}`}
			/>
			{file.isProcessing && (
				<div className="absolute inset-0 flex items-center justify-center">
					<Loader2 className="w-5 h-5 animate-spin text-black/50" />
				</div>
			)}
		</button>
	);
};

// The enlarged image. It is portaled to <body> because the file row is transformed and clipped,
// which would trap a fixed element. A click outside the image or on the X closes it, and so does
// Escape.
const ImagePreview = ({
	file,
	onClose,
}: {
	file: FileObject;
	onClose: () => void;
}) => {
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [onClose]);

	return createPortal(
		// biome-ignore lint/a11y/noStaticElementInteractions: the backdrop; the X button and Escape are the keyboard ways out
		// biome-ignore lint/a11y/useKeyWithClickEvents: as above
		<div
			className="composer-design fixed inset-0 z-100 h-screen flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
			onClick={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
		>
			<button
				type="button"
				aria-label="Close preview"
				className="absolute top-6 right-6 text-white/70 hover:text-white transition-colors"
				onClick={onClose}
			>
				<X size={32} strokeWidth={1.5} />
			</button>
			<img
				src={file.preview}
				alt={file.file.name}
				className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
			/>
		</div>,
		document.body,
	);
};

export const FileInput = ({ onAdd }: { onAdd: (files: File[]) => void }) => {
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		onAdd(Array.from(e.target.files ?? []));
		e.target.value = "";
	};
	const handleButtonClick = () => {
		fileInputRef.current?.click();
	};

	return (
		<ToolTipContainer Tip="Attach File">
			<div>
				<input
					type="file"
					ref={fileInputRef}
					onChange={handleChange}
					className="hidden"
					multiple
				/>
				<AnimateIcon animateOnHover>
					<button
						type="button"
						className="input-button"
						onClick={handleButtonClick}
						aria-label="Upload files"
					>
						<Paperclip size={20} strokeWidth={0.75} />
					</button>
				</AnimateIcon>
			</div>
		</ToolTipContainer>
	);
};
