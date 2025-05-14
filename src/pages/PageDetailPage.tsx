import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Pin, ArrowLeft, Trash2, Edit, Eye, Save } from 'lucide-react';
import { usePageStore } from '../store/pageStore';
import BlockEditor from '../components/editor/BlockEditor';
import TodoList from '../components/todo/TodoList';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Spinner from '../components/ui/Spinner';
import { formatDateTime } from '../lib/utils';
import toast from 'react-hot-toast';


const PageDetailPage: React.FC = () => {
  const { pageId } = useParams<{ pageId: string }>();
  const navigate = useNavigate();

  const {
    currentPage,
    loading,
    error,
    fetchPageById,
    updatePage,
    deletePage,
    togglePinPage,
  } = usePageStore();

  const [title, setTitle] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(true);
  const [isAutoSave, setIsAutoSave] = useState(true);
  const [isSavingContent, setIsSavingContent] = useState(false); // For manual save spinner

  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (pageId) {
      fetchPageById(pageId);
    }
  }, [pageId, fetchPageById]);

  useEffect(() => {
    if (currentPage) {
      setTitle(currentPage.title);
      if (currentPage.type === 'note') {
        const cachedContentString = localStorage.getItem(`page-${currentPage.id}-cache`);
        if (cachedContentString) {
          try {
            const cachedContent = JSON.parse(cachedContentString);
            if (cachedContent && cachedContent.blocks &&
                JSON.stringify(cachedContent) !== JSON.stringify(currentPage.content)) {
              console.log("Restoring content from cache and attempting to update store (potential save):", cachedContent);
              updatePage(currentPage.id, { content: cachedContent })
                .then(() => {
                  // toast.success("Content restored from cache and synced."); // Optional: notify if cache restore causes a save
                  localStorage.removeItem(`page-${currentPage.id}-cache`); // Clear cache if it was successfully applied and saved
                })
                .catch(() => {
                  // toast.error("Failed to sync restored cached content.");
                });
            }
          } catch (e) {
            console.error("Error loading or parsing cached content:", e);
            toast.error("Error loading cached content.");
          }
        }
      }
    }
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [currentPage, updatePage]);

  const contentData = useMemo(() => {
    return currentPage?.content || { blocks: [] };
  }, [currentPage?.content]);


  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  };

  const handleTitleSubmit = async () => {
    if (!currentPage || title === currentPage.title) {
      setIsEditingTitle(false);
      return;
    }
    setIsSavingTitle(true);
    try {
      await updatePage(currentPage.id, { title });
      toast.success('Title updated successfully!');
      setIsEditingTitle(false);
    } catch (err) {
      console.error('Error updating title:', err);
      toast.error('Failed to update title.');
    } finally {
      setIsSavingTitle(false);
    }
  };

  const handleEditorChange = useCallback(
    async (data: any) => {
      if (!currentPage) return;

      localStorage.setItem(`page-${currentPage.id}-cache`, JSON.stringify(data));
      // console.log("Content cached locally. IsAutoSave:", isAutoSave);

      if (isAutoSave) {
        if (autoSaveTimerRef.current) {
          clearTimeout(autoSaveTimerRef.current);
        }
        autoSaveTimerRef.current = setTimeout(async () => {
          // No separate setIsSavingContent here, toast is the indicator for this background task
          try {
            if (JSON.stringify(data) === JSON.stringify(currentPage.content)) {
              // console.log("AutoSave: Content is the same, skipping update.");
              return;
            }
            // console.log("Auto-saving content...", data);
            await updatePage(currentPage.id, { content: data });
            localStorage.removeItem(`page-${currentPage.id}-cache`);
            // console.log("Content auto-saved and cache cleared.");
          } catch (err) {
            console.error('Error auto-saving content:', err);
            toast.error('Auto-save failed. Changes are still cached locally.');
          }
        }, 3000); // Auto-save to backend after 5 seconds of inactivity (post-editor-debounce)
      }
    },
    [currentPage, updatePage, isAutoSave, contentData] // contentData added to deps if currentPage.content is used in check
  );

  const handleManualSave = async () => {
    if (!currentPage) return;
    const cachedContent = localStorage.getItem(`page-${currentPage.id}-cache`);
    if (!cachedContent) {
      toast.error('No new changes to save manually.');
      return;
    }
    setIsSavingContent(true);
    try {
      const content = JSON.parse(cachedContent);
      // console.log("Manually saving content:", content);
      await updatePage(currentPage.id, { content });
      localStorage.removeItem(`page-${currentPage.id}-cache`);
    } catch (err) {
      console.error('Error manually saving content:', err);
      toast.error('Failed to save changes.');
    } finally {
      setIsSavingContent(false);
    }
  };

  const handleDeletePage = async () => {
    if (!currentPage) return;
    setIsDeleting(true);
    try {
      await deletePage(currentPage.id);
      localStorage.removeItem(`page-${currentPage.id}-cache`);
      toast.success(`Page "${currentPage.title}" deleted.`);
      navigate('/');
    } catch (err: any) {
      console.error('Error deleting page:', err);
      toast.error(err.message || 'Failed to delete page.');
      // Keep modal open by not setting setShowDeleteConfirm(false) here if preferred
    } finally {
      setIsDeleting(false);
      // setShowDeleteConfirm(false); // Moved to cancel/success if preferred
    }
  };

  const handleTogglePinPage = async () => {
    if (!currentPage) return;
    try {
        await togglePinPage(currentPage.id);
        // currentPage might not be updated yet from the store, so check the opposite of current state for message
        toast.success(currentPage.is_pinned ? 'Page unpinned!' : 'Page pinned!');
    } catch (err) {
        toast.error('Failed to toggle pin status.');
    }
  };

  const toggleEditMode = () => {
    setIsReadOnly(!isReadOnly);
    toast.success(isReadOnly ? 'Edit mode enabled.' : 'View mode enabled.');
  };

  if (loading && !currentPage) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4">
        <div className="bg-red-50 text-red-600 p-6 rounded-lg shadow-md text-center">
          <p className="font-medium text-lg mb-2">Error Loading Page</p>
          <p className="text-sm mb-4">{error}</p>
          <Button
            onClick={() => pageId && fetchPageById(pageId)}
            className="mt-4"
            variant="outline"
          >
            Try again
          </Button>
          <Button
            onClick={() => navigate('/')}
            className="mt-4 ml-2"
            variant="primary"
          >
            Go to Home
          </Button>
        </div>
      </div>
    );
  }

  if (!currentPage) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4">
        <div className="bg-slate-50 text-slate-600 p-6 rounded-lg shadow-md text-center">
          <p className="font-medium text-lg">Page not found.</p>
          <Button
            onClick={() => navigate('/')}
            className="mt-4"
            variant="primary"
          >
            Go to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    // Add this to your main App.tsx or a top-level layout:
    // import { Toaster } from 'react-hot-toast';
    // <Toaster position="bottom-right" />
    <div className="flex flex-col h-screen max-w-5xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-start gap-4 mx-12 mt-12 mb-6">
          <div className="flex-1">
            {isEditingTitle ? (
              <div className="flex gap-2 items-center">
                <Input
                  value={title}
                  onChange={handleTitleChange}
                  className="text-2xl font-bold py-2 flex-grow"
                  autoFocus
                  onBlur={handleTitleSubmit}
                  onKeyDown={(e) => e.key === 'Enter' && handleTitleSubmit()}
                />
                <Button onClick={handleTitleSubmit} disabled={isSavingTitle} size="sm">
                  {isSavingTitle ? <Spinner size="sm" /> : 'Save'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setTitle(currentPage.title);
                    setIsEditingTitle(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <h1
                className="text-3xl font-bold text-slate-800 cursor-pointer hover:bg-slate-100 px-2 py-1 rounded -ml-2"
                onClick={() => setIsEditingTitle(true)}
                title="Click to edit title"
              >
                {currentPage.title}
              </h1>
            )}
            <div className="text-xs text-slate-500 mt-1 pl-2">
              <span>Created: {formatDateTime(currentPage.created_at)}</span>
              {currentPage.updated_at !== currentPage.created_at && (
                <span className="ml-3">
                  Updated: {formatDateTime(currentPage.updated_at)}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {currentPage.type === 'note' && (
              <>
                <Button
                  variant="outline"
                  onClick={() => setIsAutoSave(!isAutoSave)}
                  className="text-xs px-2 py-1.5"
                  title={isAutoSave ? "Disable automatic saving to server (still caches locally)" : "Enable automatic saving to server"}
                >
                  {isAutoSave ? 'Auto-Save: ON' : 'Auto-Save: OFF'}
                </Button>

                {!isAutoSave && (
                  <Button
                    variant="primary"
                    onClick={handleManualSave}
                    disabled={isSavingContent}
                    className="p-2 flex items-center justify-center w-[36px] h-[36px]" // Fixed size for consistency
                    title="Save Changes Manually"
                  >
                    {isSavingContent ? <Spinner size="sm" /> : <Save size={16} />}
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={toggleEditMode}
                  className="p-2"
                  title={isReadOnly ? 'Enable Editing' : 'Switch to View Mode'}
                >
                  {isReadOnly ? <Edit size={16} /> : <Eye size={16} />}
                </Button>
              </>
            )}

            <Button
              variant="outline"
              onClick={handleTogglePinPage}
              className={`p-2 ${currentPage.is_pinned ? 'text-amber-600 hover:text-amber-700 bg-amber-50' : 'text-slate-600 hover:text-slate-800'}`}
              title={currentPage.is_pinned ? 'Unpin this page' : 'Pin this page'}
            >
              <Pin size={16} />
            </Button>

            <Button
              variant="danger"
              className="p-2 text-white"
              onClick={() => setShowDeleteConfirm(true)}
              title="Delete this page"
            >
              <Trash2 size={16} />
            </Button>
          </div>
        </div>

      {/* Content Section - Scrollable */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-6 h-full">
          {currentPage.type === 'note' ? (
            <div className="bg-white rounded-lg border border-slate-200 p-4 md:p-6 h-full">
              { contentData && <BlockEditor
                key={`${currentPage.id}-${isReadOnly}`}
                data={contentData}
                onChange={handleEditorChange}
                readOnly={isReadOnly}
                autoSave={isAutoSave}
              /> }
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-slate-200 p-4 md:p-6 h-full">
              <TodoList pageId={currentPage.id} />
            </div>
          )}
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h2 className="text-xl font-bold mb-3 text-red-700">Delete Page</h2>
            <p className="mb-6 text-slate-600">
              Are you sure you want to delete "{currentPage.title}"? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleDeletePage}
                disabled={isDeleting}
                className="flex items-center gap-1.5"
              >
                {isDeleting && <Spinner size="sm" />}
                <span>{isDeleting ? 'Deleting...' : 'Yes, Delete'}</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PageDetailPage;