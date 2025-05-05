import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Pin, ArrowLeft, Trash2, Link as LinkIcon } from 'lucide-react';
import { usePageStore } from '../store/pageStore';
import BlockEditor from '../components/editor/BlockEditor';
import TodoList from '../components/todo/TodoList';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Spinner from '../components/ui/Spinner';
import { formatDateTime } from '../lib/utils';

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
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Memoize content to prevent unnecessary re-renders
  const contentData = useMemo(() => {
    return currentPage?.content || { blocks: [] };
  }, [currentPage?.content]);

  useEffect(() => {
    if (pageId) {
      fetchPageById(pageId);
    }
  }, [pageId, fetchPageById]);

  useEffect(() => {
    if (currentPage) {
      setTitle(currentPage.title);
    }
  }, [currentPage]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  };

  const handleTitleSubmit = async () => {
    if (!currentPage || title === currentPage.title) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);

    try {
      await updatePage(currentPage.id, { title });
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating title:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Use useCallback to prevent recreating this function on each render
  const handleEditorChange = useCallback(
    async (data: any) => {
      if (!currentPage) return;

      try {
        // Avoid unnecessary updates
        if (JSON.stringify(data) === JSON.stringify(currentPage.content)) {
          return;
        }

        await updatePage(currentPage.id, { content: data });
      } catch (error) {
        console.error('Error updating content:', error);
      }
    },
    [currentPage, updatePage]
  );

  const handleDeletePage = async () => {
    if (!currentPage) return;

    setIsDeleting(true);

    try {
      await deletePage(currentPage.id);
      navigate('/');
    } catch (error: any) {
      console.error('Error deleting page:', error);
      alert(error.message || 'Failed to delete page');
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleTogglePinPage = async () => {
    if (!currentPage) return;

    await togglePinPage(currentPage.id);
  };

  if (loading && !currentPage) {
    return (
      <div className="flex justify-center items-center h-96">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">
          <p className="font-medium">Error: {error}</p>
          <button
            onClick={() => pageId && fetchPageById(pageId)}
            className="mt-2 text-sm underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!currentPage) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="bg-slate-50 text-slate-600 p-4 rounded-lg">
          <p className="font-medium">Page not found</p>
          <button
            onClick={() => navigate('/')}
            className="mt-2 text-sm underline hover:no-underline"
          >
            Go to home page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1">
            {isEditing ? (
              <div className="flex gap-2">
                <Input
                  value={title}
                  onChange={handleTitleChange}
                  className="text-2xl font-bold py-2"
                  autoFocus
                />
                <Button onClick={handleTitleSubmit} disabled={isSaving}>
                  {isSaving ? <Spinner size="sm" /> : 'Save'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setTitle(currentPage.title);
                    setIsEditing(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <h1
                className="text-3xl font-bold text-slate-800 cursor-pointer hover:bg-slate-100 px-2 py-1 rounded"
                onClick={() => setIsEditing(true)}
              >
                {currentPage.title}
              </h1>
            )}

            <div className="text-sm text-slate-500 mt-1">
              <span>Created: {formatDateTime(currentPage.created_at)}</span>
              {currentPage.updated_at !== currentPage.created_at && (
                <span className="ml-3">
                  Updated: {formatDateTime(currentPage.updated_at)}
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleTogglePinPage}
              className={`flex items-center gap-1 ${
                currentPage.is_pinned ? 'text-amber-600' : ''
              }`}
            >
              <Pin size={16} />
              <span>{currentPage.is_pinned ? 'Unpin' : 'Pin'}</span>
            </Button>

            <Button
              variant="danger"
              className="flex items-center gap-1"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 size={16} />
              <span>Delete</span>
            </Button>
          </div>
        </div>
      </div>

      {currentPage.type === 'note' ? (
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <BlockEditor
            key={currentPage.id} // Ensure editor recreates on page change
            data={contentData}
            onChange={handleEditorChange}
          />
        </div>
      ) : (
        <TodoList pageId={currentPage.id} />
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-3 text-red-600">Delete Page</h2>
            <p className="mb-4 text-slate-600">
              Are you sure you want to delete "{currentPage.title}"? This action
              cannot be undone.
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
                className="flex items-center gap-1"
              >
                {isDeleting && <Spinner size="sm" />}
                <span>{isDeleting ? 'Deleting...' : 'Yes, delete'}</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PageDetailPage;
