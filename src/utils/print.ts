/**
 * Opens a print popup with the given standalone HTML document and triggers print.
 * Resolves after the print dialog is issued; rejects if popups are blocked.
 */
export function printHtmlDocument(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const popup = window.open('', '_blank', 'width=900,height=700');
    if (!popup) {
      reject(new Error('تعذر فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة وحاول مجدداً.'));
      return;
    }
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    window.setTimeout(() => {
      popup.print();
      resolve();
    }, 400);
  });
}
