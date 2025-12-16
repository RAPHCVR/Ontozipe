import React from "react";
import PdfViewer from "../PdfViewer";
import PdfCommentSection from "./PdfCommentSection";
import { Snapshot } from "../../types";

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className={`bg-white dark:bg-slate-900 rounded-lg shadow-xl relative transition-all ${
        layout === 'split' ? 'w-[95vw] h-[95vh] flex flex-col' : 'max-w-5xl w-full mx-4'
      }`}>
        
        {/* En-tête modal */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
            📄 {pdfName || 'Document PDF'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl transition-colors"
            title="Fermer (Échap)"
            aria-label="Fermer la modal"
          >
            ✖
          </button>
        </div>

        {/* Corps modal */}
        {layout === 'split' && (children || (ontologyIri && snapshot)) ? (
          <div className="flex flex-1 overflow-hidden">
            <div className="flex-1 p-4 bg-gray-50 dark:bg-slate-800">
              <PdfViewer 
                fileUrl={pdfUrl} 
                height={(window.innerHeight * 0.95) - 120}
              />
            </div>
            <div className="w-80 border-l border-gray-200 dark:border-slate-700">
              {children || (ontologyIri && snapshot && (
                <PdfCommentSection
                  pdfUrl={pdfUrl}
                  ontologyIri={ontologyIri}
                  snapshot={snapshot}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="p-6">
            <PdfViewer 
              fileUrl={pdfUrl} 
              height={window.innerHeight * 0.8 - 100}
            />
            {children && (
              <div className="mt-4 border-t border-gray-200 dark:border-slate-700 pt-4">
                {children}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PdfModal;