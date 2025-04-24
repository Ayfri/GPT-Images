export function downloadImage(imageData: string, prompt: string): void {
  // Create a download link
  const downloadLink = document.createElement('a');
  
  // Process the prompt to create a filename (remove special characters, limit length)
  const fileName = prompt
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .substring(0, 30)
    .trim();
  
  // Set properties
  downloadLink.href = imageData;
  downloadLink.download = `${fileName}_${Date.now()}.png`;
  
  // Add to body, click, and remove
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
}