import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PenSquare, ListTodo, Pin, Clock, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { usePageStore } from '../store/pageStore';
import { useAuthStore } from '../store/authStore';
import { formatDate } from '../lib/utils';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import { Page } from '../types';

type SortablePinnedPageProps = {
  page: Page;
  onTogglePin: (pageId: string) => void;
};

const SortablePinnedPage: React.FC<SortablePinnedPageProps> = ({
  page,
  onTogglePin,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: page.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="group">
      <Link
        to={`/page/${page.id}`}
        className="block p-4 rounded-lg border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all"
        onClick={(e) => {
          if (attributes['aria-pressed'] === 'true') {
            e.preventDefault();
          }
        }}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {page.type === 'note' ? (
              <PenSquare size={16} className="text-blue-600" />
            ) : (
              <ListTodo size={16} className="text-indigo-600" />
            )}
            <h3 className="font-medium text-slate-800 line-clamp-1">
              {page.title}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onTogglePin(page.id);
              }}
              className="text-amber-500 hover:text-amber-600"
            >
              <Pin size={16} />
            </button>
            
            <button
              className="touch-none cursor-grab text-slate-400 hover:text-slate-600 active:cursor-grabbing"
              {...listeners}
              {...attributes}
            >
              <GripVertical size={16} />
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-500 mt-2">
          Updated {formatDate(page.updated_at)}
        </p>
      </Link>
    </div>
  );
};

const HomePage: React.FC = () => {
  const {
    pages,
    loading,
    error,
    fetchPages,
    togglePinPage,
    createPage,
    reorderPinnedPages,
    pinnedOrder,
    fetchPinnedOrder,
  } = usePageStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [isDragging, setIsDragging] = useState(false);

  // Configure sensors with better mobile settings
  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Lower activation constraints to make dragging easier
      activationConstraint: {
        // Only activate after moving 8px - allows for regular scrolling
        distance: 8,
        // Add a small delay to distinguish between tapping and dragging
        delay: 100,
        // Add tolerance to prevent accidental dragging
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleCreateNote = async () => {
    const pageId = await createPage('Untitled Note', 'note');
    if (pageId) {
      navigate(`/page/${pageId}`);
    }
  };

  const handleCreateTodo = async () => {
    const pageId = await createPage('Untitled Todo List', 'todo');
    if (pageId) {
      navigate(`/page/${pageId}`);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      await fetchPages();
      await fetchPinnedOrder();
    };
    loadData();
  }, [fetchPages, fetchPinnedOrder]);

  // Calculate sorted pinned pages
  const sortedPinnedPages = useMemo(() => {
    const pinned = pages.filter((p) => p.is_pinned);
    if (!pinned.length) return [];

    if (!pinnedOrder.length) {
      return pinned.sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    }

    const pinnedMap = new Map(pinned.map((page) => [page.id, page]));
    const validOrder = pinnedOrder.filter((id) => pinnedMap.has(id));

    return validOrder
      .map((id) => pinnedMap.get(id))
      .filter((page): page is Page => !!page);
  }, [pages, pinnedOrder]);

  const handleDragStart = () => {
    setIsDragging(true);
    // Add a class to the body to prevent scrolling while dragging on mobile
    document.body.classList.add('overflow-hidden');
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setIsDragging(false);
    // Remove the class when drag ends
    document.body.classList.remove('overflow-hidden');
    
    const { active, over } = event;

    if (active.id !== over?.id && over && sortedPinnedPages.length) {
      const currentOrder = pinnedOrder.length
        ? pinnedOrder
        : sortedPinnedPages.map((p) => p.id);
      const oldIndex = currentOrder.indexOf(active.id as string);
      const newIndex = currentOrder.indexOf(over.id as string);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = [...currentOrder];
        const [movedId] = newOrder.splice(oldIndex, 1);
        newOrder.splice(newIndex, 0, movedId);
        reorderPinnedPages(newOrder);
      }
    }
  };

  if (loading) {
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
            onClick={fetchPages}
            className="mt-2 text-sm underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const recentPages = pages
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )
    .slice(0, 5);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">
            Welcome, {user?.name || 'there'}!
          </h1>
          <p className="text-slate-600 mt-1">
            Here's what's happening with your notes
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={handleCreateNote}
            variant="outline"
            className="flex items-center gap-2"
          >
            <PenSquare size={16} />
            <span>New Note</span>
          </Button>

          <Button
            onClick={handleCreateTodo}
            className="flex items-center gap-2"
          >
            <ListTodo size={16} />
            <span>New To-Do</span>
          </Button>
        </div>
      </div>

      {sortedPinnedPages.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Pin size={18} className="text-amber-500" />
            <h2 className="text-xl font-semibold text-slate-800">
              Pinned Pages
            </h2>
            {isDragging && (
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                Dragging...
              </span>
            )}
          </div>

          <div className={`overflow-x-auto pb-2 ${isDragging ? 'touch-none' : ''}`}>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={sortedPinnedPages.map((page) => page.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 min-w-min">
                  {sortedPinnedPages.map((page) => (
                    <SortablePinnedPage
                      key={page.id}
                      page={page}
                      onTogglePin={togglePinPage}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </section>
      )}

      <section>
        <div className="flex items-center gap-2 mb-4">
          <Clock size={18} className="text-slate-600" />
          <h2 className="text-xl font-semibold text-slate-800">Recent Pages</h2>
        </div>

        {recentPages.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-lg">
            <p className="text-slate-600 mb-4">
              No pages yet. Create your first page to get started!
            </p>

            <div className="flex gap-3 justify-center">
              <Button
                onClick={handleCreateNote}
                variant="outline"
                className="flex items-center gap-2"
              >
                <PenSquare size={16} />
                <span>New Note</span>
              </Button>

              <Button
                onClick={handleCreateTodo}
                className="flex items-center gap-2"
              >
                <ListTodo size={16} />
                <span>New To-Do</span>
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 overflow-hidden">
            <div className="divide-y divide-slate-200">
              {recentPages.map((page) => (
                <Link
                  key={page.id}
                  to={`/page/${page.id}`}
                  className="flex items-center p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="mr-3">
                    {page.type === 'note' ? (
                      <PenSquare size={20} className="text-blue-600" />
                    ) : (
                      <ListTodo size={20} className="text-indigo-600" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-slate-800 truncate">
                      {page.title}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {page.is_pinned && (
                        <span className="inline-flex items-center mr-2">
                          <Pin size={12} className="text-amber-500 mr-1" />{' '}
                          Pinned
                        </span>
                      )}
                      Updated {formatDate(page.updated_at)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default HomePage;