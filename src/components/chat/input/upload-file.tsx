import imageCompression from "browser-image-compression";
import { ChevronLeft, ChevronRight, Paperclip, X } from "lucide-react";
import { useId } from "react";
import { FileObject } from "../input";
import { ToolTipContainer } from "./tooltip-container";

export const Files = ({
	files,
	setFiles,
}: {
	files: FileObject[] | null;
	setFiles: React.Dispatch<React.SetStateAction<FileObject[] | null>>;
}) => {
	const removeFile = (id: string) => {
		setFiles((prev) => prev?.filter((f) => f.id !== id) || null);
	};

	if (!files || files.length === 0) return null;

	console.log(files?.[0]?.file);
	return (
		<div className="relative flex flex-nowrap gap-2 w-full mb-2 px-4 py-2 overflow-x-auto z-10 ">
			{files?.map((file) => (
				<div
					key={file.id}
					className="relative group bg-black/5  rounded-lg p-2 flex shrink-0 items-center gap-2 border border-black/10"
				>
					{file.type.startsWith("image/") ? (
						<img
							src={file.preview}
							alt="preview"
							className="w-10 h-10 object-cover rounded"
						/>
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
				</div>
			))}
		</div>
	);
};

export const FileInput = ({
	setFiles,
}: {
	setFiles: React.Dispatch<React.SetStateAction<FileObject[] | null>>;
}) => {
	const id = useId();
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

		const processedFiles = await Promise.all(
			selectedFiles.map(async (file) => {
				// 1. Validation
				if (file.size > MAX_SIZE_MB * 1024 * 1024) {
					alert(`File ${file.name} is too large (max ${MAX_SIZE_MB}MB)`);
					return null;
				}
				if (
					!ALLOWED_TYPES.includes(file.type) &&
					!file.name.match(/\.(ts|tsx|js|jsx|py|cpp|h)$/)
				) {
					alert(`File type ${file.type} not supported`);
					return null;
				}

				let processedFile = file;

				// 2. Compression for images
				if (file.type.startsWith("image/")) {
					const options = {
						maxSizeMB: 1,
						maxWidthOrHeight: 1920,
						useWebWorker: true,
					};
					try {
						processedFile = await imageCompression(file, options);
					} catch (error) {
						console.error("Compression failed", error);
					}
				}

				// 3. Base64 Conversion
				const base64 = await toBase64(processedFile);
				const preview = file.type.startsWith("image/")
					? URL.createObjectURL(processedFile)
					: "";

				return {
					id: Math.random().toString(36).substr(2, 9),
					file: processedFile,
					preview,
					base64,
					type: file.type,
				};
			}),
		);

		setFiles((prev) => [
			...(prev ?? []),
			...processedFiles.filter((f): f is FileObject => f !== null),
		]);
		e.target.value = ""; // Reset input
	};

	return (
		<ToolTipContainer Tip="Attach File">
			<label className="input-button" htmlFor={id}>
				<Paperclip size={20} strokeWidth={0.75} />
				<input
					id={id}
					type="file"
					className="hidden"
					accept=".jpg,.jpeg,.png,.webp,.pdf,.docx,.txt,.csv,.js,.ts,.tsx,.py"
					multiple
					onChange={handleUpload}
				/>
			</label>
		</ToolTipContainer>
	);
};
