const functions = require("firebase-functions");
const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();

/**
 * Uploads an image to Firebase Storage via Cloud Function.
 * This bypasses client-side CORS issues and creates a public URL using a download token.
 * Expects data: { image: string (base64), name: string, mimeType: string }
 */
exports.uploadImage = functions.https.onCall(async (data, context) => {
  // Ensure user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'The function must be called while authenticated.'
    );
  }

  const { image, name, mimeType } = data;

  if (!image || !name) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'The function must be called with "image" and "name" arguments.'
    );
  }

  try {
    // Explicitly use the bucket from config to avoid default bucket resolution issues
    const bucket = admin.storage().bucket("al3bara-data-b1abe.appspot.com");
    const file = bucket.file(`uploads/${name}`);
    const buffer = Buffer.from(image, 'base64');
    
    // Generate a random token for the download URL (UUID v4 format is standard for Firebase)
    // Fallback to randomBytes if randomUUID is not available in the environment
    const token = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');

    // Save the file with the token in metadata
    // This enables the standard Firebase Storage download URL format
    await file.save(buffer, {
      metadata: {
        contentType: mimeType || 'image/jpeg',
        metadata: {
          firebaseStorageDownloadTokens: token,
        }
      },
    });

    // Construct the public download URL manually using the token
    // format: https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<path>?alt=media&token=<token>
    const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(file.name)}?alt=media&token=${token}`;

    return { success: true, url: url };

  } catch (error) {
    console.error("Upload Error in Cloud Function:", error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});