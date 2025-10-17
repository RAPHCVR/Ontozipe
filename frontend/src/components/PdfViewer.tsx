import React from "react";

interface PdfViewerProps {
  fileUrl: string;
  height?: number;
}

const PdfViewer: React.FC<PdfViewerProps> = ({ fileUrl, height = 400 }) => {
  if (!fileUrl) return null;
  
  return (
    <iframe
      src={fileUrl}
      title="PDF Preview"
      width="100%"
      height={height}
      className="border border-gray-300 dark:border-slate-600 rounded"
      style={{ borderRadius: 4 }}
      allow="autoplay"
    />
  );
};

export default PdfViewer;
