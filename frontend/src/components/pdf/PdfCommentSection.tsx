import React, { useState, useEffect } from "react";
import { CommentNode, Snapshot } from "../../types";
import { useApi } from "../../lib/api";
import { useAuth } from "../../auth/AuthContext";
import { v4 as uuidv4 } from "uuid";
import CommentBlock from "../comment/CommentComponent";
import { renderCommentWithPdfLinks } from "../individuals/IndividualCard";
import { usePdfModal } from "../../hooks/usePdfModal";
import PdfModal from "./PdfModal";

interface PdfCommentSectionProps {
  pdfUrl: string;
  ontologyIri: string;
  snapshot: Snapshot;
}

const PdfCommentSection: React.FC<PdfCommentSectionProps> = ({
  pdfUrl,
  ontologyIri,
  snapshot
}) => {
  const api = useApi();
  const { user } = useAuth();
  const currentUserIri = user?.sub || "";

  const [comments, setComments] = useState<CommentNode[]>([]);
  const [draftComment, setDraftComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [availablePdfs, setAvailablePdfs] = useState<{url: string, originalName: string}[]>([]);
  
  // États pour l'auto-complétion @pdf avec navigation clavier
  const [showPdfAutocomplete, setShowPdfAutocomplete] = useState(false);
  const [pdfAutocompleteOptions, setPdfAutocompleteOptions] = useState<{url: string, originalName: string}[]>([]);
  const [pdfAutocompleteIndex, setPdfAutocompleteIndex] = useState(0);

  // Hook pour gérer la modal PDF secondaire (pour les mentions PDF dans commentaires)
  const { isOpen: showSecondaryPdf, pdfUrl: secondaryPdfUrl, pdfName: secondaryPdfName, openModal: openSecondaryPdf, closeModal: closeSecondaryPdf } = usePdfModal();

  useEffect(() => {
    fetchComments();
    extractPdfsFromSnapshot();
  }, [pdfUrl, ontologyIri, snapshot]);

  const fetchComments = async () => {
    // Convertir URL relative en URL absolue BACKEND (pas frontend)
    let fullPdfUrl = pdfUrl;
    if (pdfUrl && pdfUrl.startsWith('/uploads/')) {
      // URL uploads -> URL absolue BACKEND
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
      fullPdfUrl = `${API_BASE_URL}${pdfUrl}`;
    } else if (pdfUrl && pdfUrl.startsWith('/')) {
      // Autres URLs relatives -> frontend
      fullPdfUrl = `${window.location.origin}${pdfUrl}`;
    }

    if (!fullPdfUrl || !fullPdfUrl.startsWith('http')) {
      console.error('PdfCommentSection: Cannot fetch comments, invalid pdfUrl:', fullPdfUrl);
      return;
    }

    setLoading(true);
    try {
      const url = `/ontology/comments?resource=${encodeURIComponent(fullPdfUrl)}&ontology=${encodeURIComponent(ontologyIri)}`;
      const res = await api(url);
      if (res.ok) {
        const list: CommentNode[] = await res.json();
        setComments(list);
      } else {
        console.error('Failed to fetch PDF comments:', res.status, res.statusText);
      }
    } catch (error) {
      console.error('Error fetching PDF comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const extractPdfsFromSnapshot = () => {
    if (!snapshot || !snapshot.individuals) {
      return;
    }
    
    // Extraire tous les PDFs des individus selon le même pattern qu'IndividualCard
    const allPdfs: {url: string, originalName: string}[] = [];
    snapshot.individuals.forEach((individual: any) => {
      if (individual.properties) {
        // Extraire URLs PDF depuis les propriétés
        const pdfUrls = individual.properties.filter((p: any) => 
          p.predicate === "http://example.org/core#pdfUrl" && typeof p.value === "string"
        );
        // Extraire noms originaux
        const pdfNames = individual.properties.filter((p: any) => 
          p.predicate === "http://example.org/core#pdfOriginalName" && typeof p.value === "string"
        );
        
        // Associer URL et nom
        pdfUrls.forEach((urlProp: any, i: number) => {
          allPdfs.push({
            url: urlProp.value,
            originalName: pdfNames[i]?.value || urlProp.value.split('/').pop() || 'document.pdf'
          });
        });
      }
    });
    
    setAvailablePdfs(allPdfs);
  };

  // Détecte le déclencheur d'autocomplétion
  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setDraftComment(val);
    // Déclenche si @pdf ou [PDF: est tapé
    const trigger = /(@pdf|\[PDF:?)$/i;
    if (trigger.test(val)) {
      setShowPdfAutocomplete(true);
      setPdfAutocompleteOptions(availablePdfs);
      setPdfAutocompleteIndex(0);
    } else {
      setShowPdfAutocomplete(false);
    }
  };

  // Insertion de la mention PDF dans le commentaire
  const insertPdfMention = (pdf: {url: string, originalName: string}) => {
    // Remplace le dernier @pdf ou [PDF: par la balise
    setDraftComment((prev) =>
      prev.replace(/(@pdf|\[PDF:?)$/i, `[PDF:${pdf.originalName}]`)
    );
    setShowPdfAutocomplete(false);
  };

  const handleCreateComment = async (body: string, parent?: CommentNode) => {
    // Convertir URL relative en URL absolue backend
    let fullPdfUrl = pdfUrl;
    if (pdfUrl && pdfUrl.startsWith('/uploads/')) {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
      fullPdfUrl = `${API_BASE_URL}${pdfUrl}`;
    } else if (pdfUrl && pdfUrl.startsWith('/')) {
      fullPdfUrl = `${window.location.origin}${pdfUrl}`;
    }

    if (!fullPdfUrl || !fullPdfUrl.startsWith('http')) {
      console.error('PdfCommentSection: Invalid PDF URL for comment creation:', fullPdfUrl);
      return;
    }

    const payload = {
      id: `urn:uuid:${uuidv4()}`,
      body,
      onResource: fullPdfUrl,
      replyTo: parent?.id,
      ontologyIri: ontologyIri,
    };
    
    try {
      await api('/ontology/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      await fetchComments();
    } catch (error) {
      console.error('Error creating PDF comment:', error);
    }
  };

  const handleEditComment = async (comment: CommentNode, body: string) => {
    try {
      await api(`/ontology/comments/${encodeURIComponent(comment.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newBody: body,
          ontologyIri: ontologyIri,
        }),
      });
      await fetchComments();
    } catch (error) {
      console.error('Erreur lors de la modification du commentaire:', error);
    }
  };

  const handleDeleteComment = async (comment: CommentNode) => {
    try {
      await api(
        `/ontology/comments/${encodeURIComponent(comment.id)}?ontology=${encodeURIComponent(ontologyIri)}`,
        { method: 'DELETE' }
      );
      await fetchComments();
    } catch (error) {
      console.error('Erreur lors de la suppression du commentaire:', error);
    }
  };

  const participantCount = new Set(comments.map(c => c.createdBy)).size;
  const rootComments = comments.filter(c => !c.replyTo);

  // Gestionnaire pour les clics sur les mentions PDF dans les commentaires
  const handleCommentClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('pdf-mention-btn')) {
      e.preventDefault();
      const pdfUrl = target.getAttribute('data-pdf-url');
      const pdfName = target.textContent;
      if (pdfUrl) {
        openSecondaryPdf(pdfUrl, pdfName || 'Document PDF');
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900">
      {/* En-tête */}
      <div className="p-3 border-b border-gray-200 dark:border-slate-700">
        <h4 className="font-medium text-sm text-gray-900 dark:text-white flex items-center gap-2">
          💬 Discussion PDF
          {loading && <span className="text-xs text-gray-500 animate-pulse">Chargement...</span>}
        </h4>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {comments.length} commentaire{comments.length !== 1 ? 's' : ''} • {participantCount} participant{participantCount !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Zone de saisie */}
      <div className="p-3 border-b border-gray-200 dark:border-slate-700">
        <div className="flex flex-col gap-2">
          <div className="relative">
            <textarea
              value={draftComment}
              onChange={handleCommentChange}
              placeholder="Commenter ce document... (tapez @pdf pour suggérer des documents)"
              rows={2}
              className="w-full text-xs border rounded px-2 py-1 dark:bg-slate-800 dark:border-slate-600 resize-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-colors"
              onKeyDown={(e) => {
                if (showPdfAutocomplete && pdfAutocompleteOptions.length > 0) {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setPdfAutocompleteIndex((i) => (i + 1) % pdfAutocompleteOptions.length);
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setPdfAutocompleteIndex((i) => (i - 1 + pdfAutocompleteOptions.length) % pdfAutocompleteOptions.length);
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    insertPdfMention(pdfAutocompleteOptions[pdfAutocompleteIndex]);
                  } else if (e.key === "Escape") {
                    setShowPdfAutocomplete(false);
                  }
                } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  if (draftComment.trim()) {
                    handleCreateComment(draftComment.trim());
                    setDraftComment('');
                  }
                }
              }}
            />
            
            {/* Suggestions @pdf */}
            {showPdfAutocomplete && pdfAutocompleteOptions.length > 0 && (
              <ul className="absolute left-0 top-full z-50 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded shadow w-64 max-h-40 overflow-auto text-xs mt-1">
                {pdfAutocompleteOptions.map((pdf, idx) => (
                  <li
                    key={pdf.url}
                    className={
                      "px-2 py-1 cursor-pointer " +
                      (idx === pdfAutocompleteIndex
                        ? "bg-indigo-600 text-white"
                        : "hover:bg-indigo-100 dark:hover:bg-slate-700")
                    }
                    onMouseDown={() => insertPdfMention(pdf)}
                  >
                    {pdf.originalName}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">Ctrl+Enter pour envoyer</span>
            <button
              disabled={!draftComment.trim()}
              onClick={() => {
                if (draftComment.trim()) {
                  handleCreateComment(draftComment.trim());
                  setDraftComment('');
                }
              }}
              className="px-3 py-1 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-white text-xs rounded transition-colors"
            >
              Envoyer
            </button>
          </div>
        </div>
      </div>

      {/* Liste des commentaires */}
      <div className="flex-1 overflow-y-auto" onClick={handleCommentClick}>
        {loading ? (
          <div className="p-6 text-center">
            <div className="text-2xl mb-2">⏳</div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Chargement...</p>
          </div>
        ) : comments.length === 0 ? (
          <div className="p-6 text-center">
            <div className="text-4xl mb-2">📄</div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Aucun commentaire</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Soyez le premier à commenter !</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {rootComments.map((comment) => (
                <CommentBlock
                  key={comment.id}
                  comment={comment}
                  allComments={comments}
                  snapshot={snapshot}
                  onAddReply={(parent, body) => handleCreateComment(body, parent)}
                  onEdit={handleEditComment}
                  onDelete={handleDeleteComment}
                  currentUserIri={currentUserIri}
                  level={0}
                  ontologyIri={ontologyIri}
                  availablePdfs={availablePdfs}
                  renderBody={(body: string) => renderCommentWithPdfLinks(body, availablePdfs)}
                />
              ))}
          </div>
        )}
      </div>

      {/* Footer statistiques */}
      <div className="p-2 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>💬 {comments.length}</span>
          <span>👥 {participantCount}</span>
        </div>
      </div>

      {/* Modal PDF secondaire pour les mentions dans commentaires */}
      <PdfModal
        isOpen={showSecondaryPdf}
        pdfUrl={secondaryPdfUrl}
        pdfName={secondaryPdfName}
        onClose={closeSecondaryPdf}
        ontologyIri={ontologyIri}
        snapshot={snapshot}
      />
    </div>
  );
};

export default PdfCommentSection;