import { logError } from "@/lib/log";
import { isImage, readAsDataUrl } from "./file-object";

/**
 * Shrinks images and reads the file as a data URL. browser-image-compression is loaded on the
 * first attach, so it stays out of every chat's first load.
 */
export async function processAttachment(
	file: File,
): Promise<{ file: File; base64: string }> {
	const processed = isImage(file) ? await compressImage(file) : file;
	return { file: processed, base64: await readAsDataUrl(processed) };
}

async function compressImage(file: File): Promise<File> {
	try {
		const { default: imageCompression } = await import(
			"browser-image-compression"
		);
		return await imageCompression(file, {
			maxSizeMB: 1,
			maxWidthOrHeight: 1920,
			// Its worker mode loads the library from cdn.jsdelivr.net (third-party code with no
			// integrity check, and blocked by the CSP's script-src), so it runs on the page.
			useWebWorker: false,
		});
	} catch (error) {
		logError("Compression failed", error);
		return file;
	}
}
