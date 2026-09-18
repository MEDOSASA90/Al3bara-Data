export type DriveUploadResult =
  | { success: true; url: string }
  | { success: false; error: string };

interface DriveScriptResponse {
  success?: boolean;
  url?: string;
  error?: unknown;
}

function readEnv(name: string): string {
  const value = import.meta.env[name];
  return typeof value === 'string' ? value : '';
}

/**
 * Uploads a base64 file to Google Drive through the Apps Script web app.
 * Endpoint + folder are read from env (see .env.example) — never hardcoded.
 */
export async function uploadToDrive(
  base64String: string,
  fileName: string,
  mimeType = 'image/jpeg',
): Promise<DriveUploadResult> {
  const scriptUrl = readEnv('VITE_DRIVE_SCRIPT_URL');
  const folderId = readEnv('VITE_DRIVE_FOLDER_ID');

  if (!scriptUrl || !folderId) {
    return { success: false, error: 'Drive upload is not configured (missing env)' };
  }

  try {
    const response = await fetch(scriptUrl, {
      method: 'POST',
      redirect: 'follow',
      body: JSON.stringify({
        base64: base64String,
        type: mimeType,
        name: fileName,
        folderId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }

    const textResult = await response.text();
    let result: DriveScriptResponse;
    try {
      result = JSON.parse(textResult) as DriveScriptResponse;
    } catch {
      console.error('Non-JSON response from server:', textResult);
      throw new Error("Server returned invalid response. Please check if the Google Script is deployed as 'Anyone'.");
    }

    if (result.success && result.url) {
      return { success: true, url: result.url };
    }
    return { success: false, error: String(result.error ?? 'Unknown error from server') };
  } catch (error) {
    console.error('Upload error:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Compress (if image) -> base64 -> Drive. Returns the stored ImageRef. */
export async function uploadFileRef(
  file: File,
  prefix: string,
  compress: (file: File) => Promise<File>,
  toBase64: (file: File) => Promise<string>,
): Promise<{ name: string; url: string }> {
  const compressed = await compress(file);
  const base64 = await toBase64(compressed);
  const fileName = `${prefix}_${Date.now()}_${file.name}`;
  const result = await uploadToDrive(base64, fileName, compressed.type || 'image/jpeg');
  if (!result.success) {
    throw new Error(result.error);
  }
  return { name: fileName, url: result.url };
}
