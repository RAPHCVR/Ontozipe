import React from "react";
import PdfViewer from "../PdfViewer";
import PdfCommentSection from "./PdfCommentSection";
import { Snapshot } from "../../types";
import { useTranslation } from "../../language/useTranslation";

interface PdfModalProps {
  isOpen: boolean;
  pdfUrl: string;
  pdfName?: string;
  onClose: () => void;
  children?: React.ReactNode;
  layout?: 'full' | 'split';
  ontologyIri?: string;
  snapshot?: Snapshot;
}

const PdfModal: React.FC<PdfModalProps> = ({ 
  isOpen, 
  pdfUrl, 
  pdfName,
  onClose, 
  children,
  layout = 'split',
  ontologyIri,
  snapshot
}) => {
  const { t } = useTranslation();
  if (!isOpen || !pdfUrl) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      className="modal-backdrop pdf-modal__backdrop"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div
        className={`modal pdf-modal ${layout === "split" ? "pdf-modal--split" : "pdf-modal--stacked"}`}
      >
        {/* En-tête modal */}
        <div className="pdf-modal__header">
          <h3 className="pdf-modal__title">
            📄 {pdfName || t("pdf.modal.defaultTitle")}
          </h3>
          <button
            onClick={onClose}
            className="pdf-modal__close"
            title={t("pdf.modal.closeHint")}
            aria-label={t("pdf.modal.close")}
          >
            ✖
          </button>
        </div>

        {/* Corps modal */}
        {layout === "split" && (children || (ontologyIri && snapshot)) ? (
          <div className="pdf-modal__body pdf-modal__body--split">
            <div className="pdf-modal__viewer">
              <PdfViewer fileUrl={pdfUrl} height={window.innerHeight * 0.8} />
            </div>
            <div className="pdf-modal__comments">
              {children ||
                (ontologyIri && snapshot && (
                  <PdfCommentSection
                    pdfUrl={pdfUrl}
                    ontologyIri={ontologyIri}
                    snapshot={snapshot}
                  />
                ))}
            </div>
          </div>
        ) : (
          <div className="pdf-modal__body pdf-modal__body--stacked">
            <PdfViewer fileUrl={pdfUrl} height={window.innerHeight * 0.65} />
            {children && <div className="pdf-modal__extras">{children}</div>}
          </div>
        )}
      </div>
    </div>
  );
};

export default PdfModal;
