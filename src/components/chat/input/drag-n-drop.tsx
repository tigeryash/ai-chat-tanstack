type DragNDropProps = {
	children: React.ReactNode;
	onDrop: (files: File[]) => void;
};

const hasFiles = (e: React.DragEvent) => e.dataTransfer.types.includes("Files");

// Files dropped anywhere on the composer are attached, with the copy cursor react-dropzone showed.
// Dragged text still drops into the textarea.
const DragNDrop = ({ children, onDrop }: DragNDropProps) => (
	// biome-ignore lint/a11y/noStaticElementInteractions: a drop target only; the paperclip button is the keyboard way in
	<div
		className="w-full flex flex-col items-center"
		onDragOver={(e) => {
			if (!hasFiles(e)) return;
			e.preventDefault();
			e.dataTransfer.dropEffect = "copy";
		}}
		onDrop={(e) => {
			if (!hasFiles(e)) return;
			e.preventDefault();
			onDrop(Array.from(e.dataTransfer.files));
		}}
	>
		{children}
	</div>
);

export default DragNDrop;
