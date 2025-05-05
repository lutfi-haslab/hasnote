import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PenSquare, ListTodo, Pin, Search, Folder } from 'lucide-react';
import { usePageStore } from '../store/pageStore';
import { Page } from '../types';
import { formatDate } from '../lib/utils';
import Spinner from '../components/ui/Spinner';

const AllPagesPage: React.FC = () => {
  const { pages, loading, error, fetchPages } = usePageStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredPages, setFilteredPages] = useState<Page[]>([]);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  useEffect(() => {
    if (searchTerm) {
      const filtered = pages.filter((page) =>
        page.title.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredPages(filtered);
    } else {
      setFilteredPages(pages);
    }
  }, [searchTerm, pages]);

  const renderPageIcon = (page: Page) => {
    if (page.type === 'note') {
      return <PenSquare size={20} className="text-blue-600" />;
    } else if (page.type === 'todo') {
      return <ListTodo size={20} className="text-indigo-600" />;
    }
  };

  // Group pages by parent_id
  const groupPagesByParent = () => {
    const rootPages = filteredPages.filter((page) => page.parent_id === null);

    // For each root page, find its children
    return rootPages.map((rootPage) => {
      const children = filteredPages.filter(
        (page) => page.parent_id === rootPage.id
      );
      return { rootPage, children };
    });
  };

  const groupedPages = groupPagesByParent();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
        <h1 className="text-3xl font-bold text-slate-800">All Pages</h1>

        <div className="relative w-full md:w-auto">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={16} className="text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Search pages..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 w-full rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
          <p className="font-medium">Error: {error}</p>
          <button
            onClick={fetchPages}
            className="mt-2 text-sm underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      )}

      {!loading && filteredPages.length === 0 && (
        <div className="text-center py-12 bg-slate-50 rounded-lg">
          <p className="text-slate-600">
            {searchTerm
              ? 'No pages match your search'
              : 'No pages yet. Create your first page to get started!'}
          </p>
        </div>
      )}

      <div className="space-y-6">
        {groupedPages.map(({ rootPage, children }) => (
          <div
            key={rootPage.id}
            className="border border-slate-200 rounded-lg overflow-hidden"
          >
            <Link
              to={`/page/${rootPage.id}`}
              className="flex items-center p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
            >
              <div className="mr-3">{renderPageIcon(rootPage)}</div>

              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-slate-800 truncate">
                  {rootPage.title}
                </h3>
                <p className="text-sm text-slate-500">
                  {rootPage.is_pinned && (
                    <span className="inline-flex items-center mr-2">
                      <Pin size={12} className="text-amber-500 mr-1" /> Pinned
                    </span>
                  )}
                  {children.length > 0 && (
                    <span className="inline-flex items-center mr-2">
                      <Folder size={12} className="text-slate-400 mr-1" />{' '}
                      {children.length} sub-pages
                    </span>
                  )}
                  <span>Updated {formatDate(rootPage.updated_at)}</span>
                </p>
              </div>
            </Link>

            {children.length > 0 && (
              <div className="divide-y divide-slate-200 pl-8 border-t border-slate-200">
                {children.map((child) => (
                  <Link
                    key={child.id}
                    to={`/page/${child.id}`}
                    className="flex items-center p-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className="mr-3">{renderPageIcon(child)}</div>

                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-slate-800 truncate">
                        {child.title}
                      </h4>
                      <p className="text-sm text-slate-500">
                        {child.is_pinned && (
                          <span className="inline-flex items-center mr-2">
                            <Pin size={12} className="text-amber-500 mr-1" />{' '}
                            Pinned
                          </span>
                        )}
                        <span>Updated {formatDate(child.updated_at)}</span>
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AllPagesPage;
