// compressImage.js
export function compressImage(file, maxWidth = 1024, quality = 0.7) {
  return new Promise((resolve, reject) => {
    if (!file || !(file instanceof File)) {
      return reject("Invalid file input");
    }

    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target.result;
    };

    reader.onerror = (err) => reject(err);

    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = (maxWidth / width) * height;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) return reject("Compression failed");

          const compressedFile = new File([blob], file.name, {
            type: "image/jpeg",
          });

          resolve(compressedFile);
        },
        "image/jpeg",
        quality
      );
    };

    reader.readAsDataURL(file);
  });
}
