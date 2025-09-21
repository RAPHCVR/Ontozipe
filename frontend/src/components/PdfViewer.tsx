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
      style={{ border: "1px solid #ccc", borderRadius: 4 }}
      allow="autoplay"
    />
  );
};

export default PdfViewer;
