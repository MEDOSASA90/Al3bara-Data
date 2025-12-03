const UPLOAD_SECRET = "medo01121510582";
const TARGET_FOLDER_ID = "1EMDahJbD6D9KsJjPtC1HC8K1UscZOkq6";

function doPost(e) {
  try {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "*"
    };

    // Check secret
    const secret = e.parameter.secret;
    if (secret !== UPLOAD_SECRET) {
      return json({ success: false, error: "Unauthorized" }, cors);
    }

    // Read uploaded file (multipart/form-data)
    if (!e.files || !e.files.file) {
      return json({ success: false, error: "No file uploaded" }, cors);
    }

    const uploadedBlob = e.files.file;

    const folder = DriveApp.getFolderById(TARGET_FOLDER_ID);
    const savedFile = folder.createFile(uploadedBlob);

    return json({
      success: true,
      url: savedFile.getUrl(),
      id: savedFile.getId(),
    }, cors);

  } catch (err) {
    return json({ success: false, error: err.toString() });
  }
}

function doOptions() {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader("Access-Control-Allow-Origin", "*")
    .setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
    .setHeader("Access-Control-Allow-Headers", "*");
}

// JSON helper
function json(obj, headers = {}) {
  let output = ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);

  for (let h in headers) {
    output = output.setHeader(h, headers[h]);
  }

  return output;
}
