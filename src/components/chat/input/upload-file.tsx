import imageCompression from "browser-image-compression";
import { Loader2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { AnimateIcon } from "@/components/animate-ui/icons/icon";
import { Paperclip } from "@/components/animate-ui/icons/paperclip";
import type { FileObject } from "../input";
import { ToolTipContainer } from "./tooltip-container";

export const Files = ({
	files,
	setFiles,
}: {
	files: FileObject[] | null;
	setFiles: React.Dispatch<React.SetStateAction<FileObject[] | null>>;
}) => {
	const [selectedImage, setSelectedImage] = useState<string | null>(null);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") setSelectedImage(null);
		};

		if (selectedImage) {
			window.addEventListener("keydown", handleKeyDown);
		}
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [selectedImage]);

	const removeFile = (id: string) => {
		setFiles((prev) => prev?.filter((f) => f.id !== id) || null);
	};

	if (!files || files.length === 0) return null;

	return (
		<>
			<div className="relative flex flex-nowrap gap-2 w-full  px-4 py-2 overflow-x-auto z-10 ">
				<AnimatePresence mode="popLayout">
					{files?.map((file) => (
						<motion.div
							layout
							initial={{ opacity: 0, scale: 0.8, x: 50 }}
							animate={{ opacity: 1, scale: 1, x: 0 }}
							exit={{ opacity: 0, scale: 0.8, x: -20 }}
							transition={{ duration: 0.3 }}
							key={file.id}
							className="relative group bg-black/5  rounded-lg p-2 flex shrink-0 items-center space-x-2 border border-black/10"
						>
							{file.type.startsWith("image/") ? (
								<button
									type="button"
									className="relative shrink-0 focus:outline-none"
									onClick={() =>
										!file.isProcessing && setSelectedImage(file.preview)
									}
									disabled={file.isProcessing}
								>
									<img
										src={file.preview}
										alt="preview"
										className={`w-10 h-10 object-cover rounded ${file.isProcessing ? "opacity-50" : ""}`}
									/>
									{file.isProcessing && (
										<div className="absolute inset-0 flex items-center justify-center">
											<Loader2 className="w-5 h-5 animate-spin text-black/50" />
										</div>
									)}
								</button>
							) : (
								<div className="w-10 h-10 bg-blue-100 flex items-center justify-center rounded text-[10px] font-bold">
									{file.file.name.split(".").pop()?.toUpperCase()}
								</div>
							)}
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
								onClick={() => removeFile(file.id)}
								className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600
                             text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-all shadow-sm z-30"
							>
								<X size={12} />
							</button>
						</motion.div>
					))}
				</AnimatePresence>
			</div>
			{selectedImage && (
				<button
					className="fixed inset-0 z-100 h-screen flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
					onClick={() => setSelectedImage(null)}
					type="button"
				>
					<button
						type="button"
						className="absolute top-6 right-6 text-white/70 hover:text-white transition-colors"
						onClick={() => setSelectedImage(null)}
					>
						<X size={32} strokeWidth={1.5} />
					</button>
					<img
						src={selectedImage}
						alt="Enlarged preview"
						className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
						onKeyDown={(e) => e.stopPropagation()}
						onClick={(e) => e.stopPropagation()}
					/>
					{/* <p>{selectedImage}</p> */}
				</button>
			)}
		</>
	);
};

export const FileInput = ({
	setFiles,
}: {
	setFiles: React.Dispatch<React.SetStateAction<FileObject[] | null>>;
}) => {
	const fileInputRef = useRef<HTMLInputElement>(null);

	const MAX_SIZE_MB = 20;
	const ALLOWED_TYPES = [
		"image/jpeg",
		"image/png",
		"image/webp",
		"application/pdf",
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		"text/plain",
		"text/csv",
		"text/javascript",
		"text/typescript",
	];

	const toBase64 = (file: File): Promise<string> =>
		new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.readAsDataURL(file);
			reader.onload = () => resolve(reader.result as string);
			reader.onerror = (error) => reject(error);
		});

	const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const selectedFiles = Array.from(e.target.files || []);

		const initialFiles: FileObject[] = selectedFiles.map((file) => ({
			id: Math.random().toString(36).substr(2, 9),
			file: file,
			preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : "",
			base64: "",
			type: file.type,
			isProcessing: true,
		}));

		setFiles((prev) => [...(prev ?? []), ...initialFiles]);
		e.target.value = "";

		for (const optimisticFile of initialFiles) {
			const file = optimisticFile.file;

			if (
				file.size > MAX_SIZE_MB * 1024 * 1024 ||
				(!ALLOWED_TYPES.includes(file.type) &&
					!file.name.match(/\.(ts|tsx|js|jsx|py|cpp|h)$/))
			) {
				setFiles(
					(prev) => prev?.filter((f) => f.id !== optimisticFile.id) || null,
				);
				continue;
			}

			let processedFile = file;
			if (file.type.startsWith("image/")) {
				try {
					processedFile = await imageCompression(file, {
						maxSizeMB: 1,
						maxWidthOrHeight: 1920,
						useWebWorker: true,
					});
				} catch (error) {
					console.error("Compression failed", error);
				}
			}

			const base64 = await toBase64(processedFile);
			const finalPreview = file.type.startsWith("image/")
				? URL.createObjectURL(processedFile)
				: "";

			setFiles(
				(prev) =>
					prev?.map((f) =>
						f.id === optimisticFile.id
							? {
									...f,
									file: processedFile,
									preview: finalPreview,
									base64,
									isProcessing: false,
								}
							: f,
					) || null,
			);
		}
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
					onChange={handleUpload}
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
