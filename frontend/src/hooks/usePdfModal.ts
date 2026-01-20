import { useState } from 'react';

interface PdfModalState {
  isOpen: boolean;
  pdfUrl: string;
  pdfName?: string;
}

/**
 * Hook personnalisé pour gérer l'état des modals PDF
 * Suit les patterns OntoZipe pour la gestion d'état locale
 */
export const usePdfModal = () => {
  const [modalState, setModalState] = useState<PdfModalState>({
    isOpen: false,
    pdfUrl: '',
    pdfName: undefined,
  });

  const openModal = (pdfUrl: string, pdfName?: string) => {
    setModalState({
      isOpen: true,
      pdfUrl,
      pdfName,
    });
  };

  const closeModal = () => {
    setModalState({
      isOpen: false,
      pdfUrl: '',
      pdfName: undefined,
    });
  };

  return {
    ...modalState,
    openModal,
    closeModal,
  };
};