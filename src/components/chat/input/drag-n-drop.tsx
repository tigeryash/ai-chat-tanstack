import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import type { FileObject } from "../input";

type DragNDropProps = {
	children: React.ReactNode;
	setFiles: React.Dispatch<React.SetStateAction<FileObject[] | null>>;
};

const DragNDrop = ({ children, setFiles }: DragNDropProps) => {
	const onDrop = useCallback(
		async (acceptedFiles: File[]) => {
			const newFiles = await Promise.all(
				acceptedFiles.map(async (file) => {
					const base64 = await new Promise<string>((resolve) => {
						const reader = new FileReader();
						reader.onloadend = () => resolve(reader.result as string);
						reader.readAsDataURL(file);
					});

					return {
						id: Math.random().toString(36).substring(7),
						file,
						preview: URL.createObjectURL(file),
						base64,
						type: file.type,
						isProcessing: false,
					};
				}),
			);
			setFiles((prev) => [...(prev || []), ...newFiles]);
		},
		[setFiles],
	);

	const { getRootProps, getInputProps } = useDropzone({
		onDrop,
		noClick: true, // Prevents file dialog when clicking the input area
		noKeyboard: true,
	});
	return (
		<div {...getRootProps()} className="w-full flex flex-col items-center">
			<input {...getInputProps()} />
			{children}
		</div>
	);
};

export default DragNDrop;
