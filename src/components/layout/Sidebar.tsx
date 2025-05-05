import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ChevronRight,
  ChevronDown,
  Plus,
  PenSquare,
  ListTodo,
  Pin,
  Settings,
  HomeIcon,
  GripVertical,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { usePageStore } from '../../store/pageStore';
import Button from '../ui/Button';
import { Page } from '../../types';

type SortablePageItemProps = {
  page: Page;
  onCreatePage: (parentId: string) => void;
};

const SortablePageItem: React.FC<SortablePageItemProps> = ({
  page,
  onCreatePage,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: page.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    touchAction: 'none', // Important for mobile drag
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="flex items-center px-3 py-1.5 text-sm rounded-md hover:bg-slate-100 transition-colors group relative"
    >
      <div
        {...listeners}
        className="cursor-grab hover:cursor-grabbing mr-2 opacity-0 group-hover:opacity-100 touch-none"
      >
        <GripVertical size={16} className="text-slate-400" />
      </div>

      <Link
        to={`/page/${page.id}`}
        className="flex items-center flex-1 overflow-hidden"
        onClick={(e) => {
          if (attributes['aria-pressed'] === 'true') {
            e.preventDefault();
          }
        }}
      >
        {page.type === 'note' ? (
          <PenSquare size={16} className="mr-2 text-slate-500" />
        ) : (
          <ListTodo size={16} className="mr-2 text-slate-500" />
        )}
        <span className="truncate">{page.title}</span>
      </Link>

      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onCreatePage(page.id);
        }}
        className="p-1 rounded hover:bg-slate-200 text-slate-400 opacity-0 group-hover:opacity-100"
        title="Add page"
      >
        <Plus size={14} />
      </button>
    </div>
  );
};

type PageItemProps = {
  page: Page;
  level: number;
  onCreatePage: (parentId: string) => void;
};

const PageItem: React.FC<PageItemProps> = ({ page, level, onCreatePage }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { pages, togglePinPage } = usePageStore();

  const childPages = pages.filter((p) => p.parent_id === page.id);
  const hasChildren = childPages.length > 0;

  const toggleOpen = () => {
    if (hasChildren) {
      setIsOpen(!isOpen);
    }
  };

  const handleTogglePin = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    togglePinPage(page.id);
  };

  return (
    <div className="w-full">
      <Link
        to={`/page/${page.id}`}
        className={`flex items-center px-3 py-1.5 text-sm rounded-md hover:bg-slate-100 transition-colors group ${
          level === 0 ? 'font-medium' : ''
        }`}
        style={{
          paddingLeft: `${level * 12 + 12}px`,
        }}
      >
        <div className="flex items-center flex-1 overflow-hidden">
          {hasChildren && (
            <button
              onClick={toggleOpen}
              className="mr-1 p-0.5 hover:bg-slate-200 rounded"
            >
              {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          )}
          {!hasChildren && <div className="w-5" />}

          {page.type === 'note' ? (
            <PenSquare size={16} className="mr-2 text-slate-500" />
          ) : (
            <ListTodo size={16} className="mr-2 text-slate-500" />
          )}

          <span className="truncate">{page.title}</span>
        </div>

        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleTogglePin}
            className={`p-1 rounded hover:bg-slate-200 ${
              page.is_pinned ? 'text-amber-500' : 'text-slate-400'
            }`}
            title={page.is_pinned ? 'Unpin' : 'Pin'}
          >
            <Pin size={14} />
          </button>

          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onCreatePage(page.id);
            }}
            className="p-1 rounded hover:bg-slate-200 text-slate-400"
            title="Add page"
          >
            <Plus size={14} />
          </button>
        </div>
      </Link>

      {isOpen && hasChildren && (
        <div>
          {childPages.map((childPage) => (
            <PageItem
              key={childPage.id}
              page={childPage}
              level={level + 1}
              onCreatePage={onCreatePage}
            />
          ))}
        </div>
      )}
    </div>
  );
};

type SidebarProps = {
  isOpen: boolean;
  onToggle: () => void;
};

const Sidebar: React.FC<SidebarProps> = ({ isOpen }) => {
  const navigate = useNavigate();
  const [isCreatingPage, setIsCreatingPage] = useState(false);
  const [newPageType, setNewPageType] = useState<'note' | 'todo'>('note');
  const [parentId, setParentId] = useState<string | null>(null);

  const {
    pages,
    loading,
    createPage,
    fetchPages,
    reorderPinnedPages,
    fetchPinnedOrder,
    pinnedOrder,
  } = usePageStore();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  useEffect(() => {
    const loadData = async () => {
      await fetchPages();
      await fetchPinnedOrder();
    };
    loadData();
  }, [fetchPages, fetchPinnedOrder]);

  const rootPages = pages.filter((page) => page.parent_id === null);
  const pinnedPages = pages.filter((page) => page.is_pinned);

  // Update the sortedPinnedPages calculation
  const sortedPinnedPages = useMemo(() => {
    if (!pinnedPages.length) return [];

    // If no order exists, return most recently updated first
    if (!pinnedOrder.length) {
      return [...pinnedPages].sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    }

    // Create a map of pinned pages for quick lookup
    const pinnedPagesMap = new Map(pinnedPages.map((page) => [page.id, page]));

    // Filter out any IDs in pinnedOrder that no longer exist
    const validOrder = pinnedOrder.filter((id) => pinnedPagesMap.has(id));

    // Add any pinned pages that aren't in the order
    const completeOrder = [
      ...validOrder,
      ...pinnedPages
        .filter((page) => !validOrder.includes(page.id))
        .map((page) => page.id),
    ];

    // Update the pinnedOrder if it was missing some pages
    if (completeOrder.length !== pinnedOrder.length) {
      setTimeout(() => reorderPinnedPages(completeOrder), 0);
    }

    // Return the sorted pages
    return completeOrder
      .map((id) => pinnedPagesMap.get(id))
      .filter((page): page is Page => !!page);
  }, [pinnedPages, pinnedOrder, reorderPinnedPages]);

  // Update the handleDragEnd function
  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      const currentOrder = pinnedOrder.length
        ? pinnedOrder
        : sortedPinnedPages.map((p) => p.id);
      const oldIndex = currentOrder.indexOf(active.id);
      const newIndex = currentOrder.indexOf(over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = [...currentOrder];
        const [movedId] = newOrder.splice(oldIndex, 1);
        newOrder.splice(newIndex, 0, movedId);
        reorderPinnedPages(newOrder);
      }
    }
  };

  useEffect(() => {
    console.log('Current pinnedOrder:', pinnedOrder);
    console.log('Sorted pinned pages:', sortedPinnedPages);
  }, [pinnedOrder, sortedPinnedPages]);

  const handleCreatePage = async () => {
    setIsCreatingPage(true);
  };

  const handleCreatePageWithParent = (parentId: string) => {
    setParentId(parentId);
    setIsCreatingPage(true);
  };

  const handleConfirmCreatePage = async () => {
    const title =
      newPageType === 'note' ? 'Untitled Note' : 'Untitled To-Do List';
    const pageId = await createPage(title, newPageType, parentId);

    setIsCreatingPage(false);
    setNewPageType('note');
    setParentId(null);

    if (pageId) {
      navigate(`/page/${pageId}`);
    }
  };

  const sidebarVariants = {
    open: { x: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } },
    closed: {
      x: '-100%',
      transition: { type: 'spring', stiffness: 300, damping: 30 },
    },
  };

  return (
    <>
      <motion.div
        className="fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 z-10 flex flex-col md:relative md:translate-x-0 h-full"
        variants={sidebarVariants}
        initial="closed"
        animate={isOpen ? 'open' : 'closed'}
      >
        <div className="p-4 border-b border-slate-200 flex justify-between items-center">
          <h1 className="text-xl font-bold">HasNote</h1>
        </div>

        <div className="p-3">
          <Button
            variant="outline"
            className="w-full flex items-center justify-center gap-2"
            onClick={handleCreatePage}
          >
            <Plus size={16} />
            <span>New page</span>
          </Button>
        </div>

        <div className="px-3 py-2">
          <Link
            to="/"
            className="items-center py-1.5 text-sm rounded-md hover:bg-slate-100 transition-colors hidden md:flex"
          >
            <HomeIcon size={16} className="mr-2 text-slate-500" />
            <span className="truncate">All Notes</span>
          </Link>
        </div>

        {pinnedPages.length > 0 && (
          <div className="px-3 py-2">
            <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
              Pinned
            </h2>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
              onDragStart={() => {
                document.body.style.cursor = 'grabbing';
              }}
              // onDragEnd={() => {
              //   document.body.style.cursor = '';
              // }}
            >
              <SortableContext
                items={sortedPinnedPages.map((page) => page.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-1">
                  {sortedPinnedPages.map((page) => (
                    <SortablePageItem
                      key={page.id}
                      page={page}
                      onCreatePage={handleCreatePageWithParent}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        )}

        <div className="px-3 py-2 flex-1 overflow-y-auto">
          <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
            Pages
          </h2>

          {loading ? (
            <div className="text-sm text-slate-500 px-3 py-2">Loading...</div>
          ) : rootPages.length === 0 ? (
            <div className="text-sm text-slate-500 px-3 py-2">No pages yet</div>
          ) : (
            <div className="space-y-1">
              {rootPages.map((page) => (
                <PageItem
                  key={page.id}
                  page={page}
                  level={0}
                  onCreatePage={handleCreatePageWithParent}
                />
              ))}
            </div>
          )}
        </div>

        <div className="p-3 border-t border-slate-200">
          <Link
            to="/settings"
            className="flex items-center px-3 py-2 text-sm rounded-md hover:bg-slate-100 transition-colors"
          >
            <Settings size={16} className="mr-2 text-slate-500" />
            <span>Settings</span>
          </Link>
        </div>
      </motion.div>

      {isCreatingPage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-5 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Create new page</h2>

            <div className="space-y-4 mb-5">
              <div className="flex gap-4">
                <button
                  className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-lg border ${
                    newPageType === 'note'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200'
                  }`}
                  onClick={() => setNewPageType('note')}
                >
                  <PenSquare
                    size={24}
                    className={
                      newPageType === 'note'
                        ? 'text-blue-500'
                        : 'text-slate-500'
                    }
                  />
                  <span
                    className={
                      newPageType === 'note'
                        ? 'text-blue-700'
                        : 'text-slate-700'
                    }
                  >
                    Note
                  </span>
                </button>

                <button
                  className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-lg border ${
                    newPageType === 'todo'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200'
                  }`}
                  onClick={() => setNewPageType('todo')}
                >
                  <ListTodo
                    size={24}
                    className={
                      newPageType === 'todo'
                        ? 'text-blue-500'
                        : 'text-slate-500'
                    }
                  />
                  <span
                    className={
                      newPageType === 'todo'
                        ? 'text-blue-700'
                        : 'text-slate-700'
                    }
                  >
                    To-Do List
                  </span>
                </button>
              </div>

              {parentId && (
                <div className="text-sm text-slate-600">
                  This page will be created under another page.
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreatingPage(false);
                  setNewPageType('note');
                  setParentId(null);
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleConfirmCreatePage}>Create</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
