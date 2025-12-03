
/**
 * Uploads a file (Base64) directly to a Google Apps Script Web App.
 * @param {string} base64String - The raw base64 string (without data prefix).
 * @param {string} fileName - The destination file name.
 * @param {string} mimeType - The mime type of the file.
 * @returns {Promise<{success: boolean, url?: string, error?: any}>}
 */
export async function uploadToDrive(base64String, fileName, mimeType = 'image/jpeg') {
  // The Google Apps Script Web App URL - Updated to new deployment
  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyc4HJRk5xcIkRB5DhBkCz6kQ-GkKp1XEKSrJmrCGRqO6BlKdOLq3CK-sCq5_DYe1u3/exec";
  
  // The specific Google Drive Folder ID provided in the prompt
  // URL: https://drive.google.com/drive/folders/1EMDahJbGD69KSJiPtClHC8K1UscZOkq6
  const FOLDER_ID = "1EMDahJbGD69KSJiPtClHC8K1UscZOkq6";

  try {
    // We use a standard fetch POST with 'redirect: follow' to handle the 302 redirect from Google Script
    const response = await fetch(SCRIPT_URL, {
      method: "POST",
      redirect: "follow", 
      body: JSON.stringify({
        base64: base64String,
        type: mimeType,
        name: fileName,
        folderId: FOLDER_ID
      })
    });

    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }

    // Parse the JSON response
    const textResult = await response.text();
    let result;
    
    try {
        result = JSON.parse(textResult);
    } catch (e) {
        console.error("Non-JSON response from server:", textResult);
        // If the response isn't JSON, it might be an HTML error page from Google
        throw new Error("Server returned invalid response. Please check if the Google Script is deployed as 'Anyone'.");
    }

    if (result.success && result.url) {
        return { success: true, url: result.url };
    } else {
        return { success: false, error: result.error || "Unknown error from server" };
    }

  } catch (err) {
    console.error("Upload error:", err);
    return { success: false, error: err.message || JSON.stringify(err) };
  }
}
