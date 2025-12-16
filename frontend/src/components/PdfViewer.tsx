import React from "react";
import { useTranslation } from "../language/useTranslation";

interface PdfViewerProps {
  fileUrl: string;
  height?: number;
}

const PdfViewer: React.FC<PdfViewerProps> = ({ fileUrl, height = 400 }) => {
  const { t } = useTranslation();
  if (!fileUrl) return null;
  
  return (
    <iframe
      src={fileUrl}
      title={t("pdf.viewer.title")}
      width="100%"
      height={height}
      className="pdf-viewer-frame"
      allow="autoplay"
    />
  );
};

export default PdfViewer;
