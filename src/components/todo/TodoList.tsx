import React, { useState, useEffect, useRef } from 'react';
import {
  Check,
  ChevronDown,
  Edit2,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  X,
  Clock,
  RefreshCw,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { TodoItem } from '../../types';
import { formatShortDateTime } from '../../lib/utils';
import Spinner from '../ui/Spinner';
import BlockEditor from '../editor/BlockEditor';
import { getDB, addToSyncQueue } from '../../lib/db';

type TodoListProps = {
  pageId: string;
};

type TodoHistory = {
  todos: TodoItem[];
  timestamp: number;
};

type SortDirection = 'asc' | 'desc';

const TodoList: React.FC<TodoListProps> = ({ pageId }) => {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [newTodoText, setNewTodoText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [history, setHistory] = useState<TodoHistory[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [expandedTodos, setExpandedTodos] = useState<Set<string>>(new Set());
  const [fullNotesTodos, setFullNotesTodos] = useState<Set<string>>(new Set());
  const [contentHeights, setContentHeights] = useState<Record<string, number>>(
    {}
  );
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(5);
  
  // Sorting state
  const [sortBy, setSortBy] = useState<'created_at'|'updated_at'>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  const editInputRef = useRef<HTMLInputElement>(null);
  const contentRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Initialize history when todos first load
  useEffect(() => {
    if (todos.length > 0 && history.length === 0) {
      setHistory([
        { todos: JSON.parse(JSON.stringify(todos)), timestamp: Date.now() },
      ]);
    }
  }, [todos, history.length]);

  // Focus input when editing starts
  useEffect(() => {
    if (editingTodoId && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingTodoId]);

  useEffect(() => {
    fetchTodos();
  }, [pageId]);

  // Track history changes to set undo availability
  useEffect(() => {
    setCanUndo(history.length > 1);
  }, [history]);

  // Check content heights after rendering
  useEffect(() => {
    // Use a timeout to ensure DOM is fully rendered
    const timeoutId = setTimeout(() => {
      const newHeights: Record<string, number> = {};
      Object.keys(contentRefs.current).forEach((todoId) => {
        if (contentRefs.current[todoId]) {
          newHeights[todoId] = contentRefs.current[todoId]?.scrollHeight || 0;
        }
      });
      setContentHeights(newHeights);
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [expandedTodos, todos]);

  const toggleTodoExpand = (id: string) => {
    setExpandedTodos((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleFullNotes = (id: string) => {
    setFullNotesTodos((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const fetchTodos = async () => {
    try {
      const db = await getDB();
      setLoading(true);
      setError(null);

      // Try to get from IndexedDB first
      const cachedTodos = await db.getAllFromIndex('todos', 'by-page', pageId);
      if (cachedTodos.length > 0) {
        setTodos(cachedTodos);
        setLoading(false);
      }

      // Then try to get from Supabase
      const { data, error } = await supabase
        .from('todo_items')
        .select('*')
        .eq('page_id', pageId)
        .order('created_at');

      if (error) throw error;

      setTodos(data as TodoItem[]);

      // Update cache
      const tx = db.transaction('todos', 'readwrite');
      await Promise.all([...data.map((todo) => tx.store.put(todo)), tx.done]);
    } catch (error: any) {
      console.error('Error fetching todos:', error);
      setError(error.message || 'Failed to fetch todos');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTodo = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newTodoText.trim()) return;

    try {
      const db = await getDB();
      const newTodo = {
        id: crypto.randomUUID(),
        text: newTodoText.trim(),
        completed: false,
        page_id: pageId,
        content: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Update local state immediately
      setTodos((prev) => [newTodo, ...prev]);
      setNewTodoText('');

      // Store in IndexedDB
      await db.add('todos', newTodo);

      // Add to sync queue
      await addToSyncQueue('create', 'todos', newTodo);

      // Try to sync with Supabase
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from('todo_items')
          .insert(newTodo)
          .select()
          .single();

        if (error) throw error;
      }
      
      // Reset to first page when adding a new todo
      setCurrentPage(1);
    } catch (error: any) {
      console.error('Error creating todo:', error);
      setError(error.message || 'Failed to create todo');
    }
  };

  const handleToggleComplete = async (todoId: string) => {
    const todoToUpdate = todos.find((todo) => todo.id === todoId);

    if (!todoToUpdate) return;

    try {
      const db = await getDB();
      const updatedTodo = {
        ...todoToUpdate,
        completed: !todoToUpdate.completed,
        updated_at: new Date().toISOString(),
      };

      // Update local state
      setTodos(todos.map((todo) => (todo.id === todoId ? updatedTodo : todo)));

      // Update IndexedDB
      await db.put('todos', updatedTodo);

      // Add to sync queue
      await addToSyncQueue('update', 'todos', updatedTodo);

      // Try to sync with Supabase
      if (navigator.onLine) {
        const { error } = await supabase
          .from('todo_items')
          .update(updatedTodo)
          .eq('id', todoId);

        if (error) throw error;
      }
    } catch (error: any) {
      console.error('Error updating todo:', error);
      setError(error.message || 'Failed to update todo');
    }
  };

  const handleEditorChange = async (todoId: string, data: any) => {
    const todoToUpdate = todos.find((todo) => todo.id === todoId);

    if (!todoToUpdate) return;

    try {
      const db = await getDB();
      const updatedTodo = {
        ...todoToUpdate,
        content: data,
        updated_at: new Date().toISOString(),
      };

      // Update local state
      setTodos(todos.map((todo) => (todo.id === todoId ? updatedTodo : todo)));

      // Update IndexedDB
      await db.put('todos', updatedTodo);

      // Add to sync queue
      await addToSyncQueue('update', 'todos', updatedTodo);

      // Try to sync with Supabase
      if (navigator.onLine) {
        const { error } = await supabase
          .from('todo_items')
          .update(updatedTodo)
          .eq('id', todoId);

        if (error) throw error;
      }
    } catch (error: any) {
      console.error('Error updating todo content:', error);
      setError(error.message || 'Failed to update todo content');
    }
  };

  const handleStartEdit = (todo: TodoItem) => {
    setEditingTodoId(todo.id);
    setEditText(todo.text);
  };

  const handleCancelEdit = () => {
    setEditingTodoId(null);
    setEditText('');
  };

  const handleSaveEdit = async (todoId: string) => {
    if (
      !editText.trim() ||
      editText.trim() === todos.find((t) => t.id === todoId)?.text
    ) {
      handleCancelEdit();
      return;
    }

    try {
      const db = await getDB();
      const todoToUpdate = todos.find((todo) => todo.id === todoId);
      if (!todoToUpdate) return;

      const updatedTodo = {
        ...todoToUpdate,
        text: editText.trim(),
        updated_at: new Date().toISOString(),
      };

      // Update local state
      setTodos(todos.map((todo) => (todo.id === todoId ? updatedTodo : todo)));

      // Update IndexedDB
      await db.put('todos', updatedTodo);

      // Add to sync queue
      await addToSyncQueue('update', 'todos', updatedTodo);

      // Try to sync with Supabase
      if (navigator.onLine) {
        const { error } = await supabase
          .from('todo_items')
          .update(updatedTodo)
          .eq('id', todoId);

        if (error) throw error;
      }

      handleCancelEdit();
    } catch (error: any) {
      console.error('Error updating todo text:', error);
      setError(error.message || 'Failed to update todo text');
    }
  };

  const handleDeleteTodo = async (todoId: string) => {
    try {
      const db = await getDB();
      // Update local state
      setTodos(todos.filter((todo) => todo.id !== todoId));

      // Remove from IndexedDB
      await db.delete('todos', todoId);

      // Add to sync queue
      await addToSyncQueue('delete', 'todos', { id: todoId });

      // Try to sync with Supabase
      if (navigator.onLine) {
        const { error } = await supabase
          .from('todo_items')
          .delete()
          .eq('id', todoId);

        if (error) throw error;
      }
      
      // If we deleted the last item on the current page, go back a page
      const totalPages = Math.ceil((todos.length - 1) / itemsPerPage);
      if (currentPage > totalPages && currentPage > 1) {
        setCurrentPage(totalPages);
      }
    } catch (error: any) {
      console.error('Error deleting todo:', error);
      setError(error.message || 'Failed to delete todo');
    }
  };

  const handleUndo = async () => {
    if (history.length <= 1) return;

    try {
      const db = await getDB();
      // Get the previous state
      const newHistory = [...history];
      newHistory.pop(); // Remove current state
      const previousState = newHistory[newHistory.length - 1];

      // Update UI immediately (optimistic update)
      setHistory(newHistory);
      setTodos(previousState.todos);

      // Sync with IndexedDB
      const tx = db.transaction('todos', 'readwrite');
      await Promise.all([
        ...previousState.todos.map((todo) => tx.store.put(todo)),
        tx.done,
      ]);

      // Add to sync queue
      await addToSyncQueue('update', 'todos', previousState.todos);

      // Try to sync with Supabase
      if (navigator.onLine) {
        await fetchTodos();
      }
    } catch (error: any) {
      console.error('Error performing undo:', error);
      setError(error.message || 'Failed to undo');
    }
  };

  const shouldShowExpandButton = (todo: TodoItem) => {
    return todo.content?.blocks?.length > 0;
  };
  
  // Sort todos based on current sort settings
  const sortedTodos = [...todos].sort((a, b) => {
    const dateA = new Date(a[sortBy]).getTime();
    const dateB = new Date(b[sortBy]).getTime();
    
    return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
  });
  
  // Calculate pagination
  const totalPages = Math.ceil(sortedTodos.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentTodos = sortedTodos.slice(indexOfFirstItem, indexOfLastItem);
  
  // Page navigation
  const goToPage = (pageNumber: number) => {
    setCurrentPage(Math.max(1, Math.min(pageNumber, totalPages)));
  };
  
  const toggleSortDirection = () => {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
  };
  
  const changeSortField = (field: 'created_at' | 'updated_at') => {
    if (sortBy === field) {
      toggleSortDirection();
    } else {
      setSortBy(field);
      setSortDirection('desc'); // Default to newest first when changing fields
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-lg bg-red-50 border border-red-200">
        <p className="text-red-600 flex items-center gap-2">
          <X size={18} />
          {error}
        </p>
        <button
          onClick={fetchTodos}
          className="mt-2 text-blue-600 hover:underline flex items-center gap-1"
        >
          <RefreshCw size={14} />
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="py-6">
      <div className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
        <div className="flex justify-between items-center px-5 py-3 bg-gradient-to-r from-blue-50 to-slate-50 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Clock size={18} className="text-blue-500" />
            Tasks
            <span className="text-xs font-normal text-slate-500">
              ({todos.length} {todos.length === 1 ? 'item' : 'items'})
            </span>
          </h3>
          
          <div className="flex items-center gap-2">
            <div className="flex text-xs">
              <button 
                onClick={() => changeSortField('created_at')} 
                className={`px-2 py-1 border border-r-0 rounded-l-md flex items-center gap-1 ${
                  sortBy === 'created_at' 
                    ? 'bg-blue-100 border-blue-300 text-blue-800' 
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <CalendarDays size={12} />
                Date created
                {sortBy === 'created_at' && (
                  sortDirection === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />
                )}
              </button>
              <button 
                onClick={() => changeSortField('updated_at')} 
                className={`px-2 py-1 border rounded-r-md flex items-center gap-1 ${
                  sortBy === 'updated_at' 
                    ? 'bg-blue-100 border-blue-300 text-blue-800' 
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <RefreshCw size={12} />
                Last updated
                {sortBy === 'updated_at' && (
                  sortDirection === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />
                )}
              </button>
            </div>
            
            {canUndo && (
              <button
                onClick={handleUndo}
                className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-md transition-colors"
                title="Undo"
              >
                <RotateCcw size={16} />
              </button>
            )}
          </div>
        </div>
        
        {/* Add task form - always visible at the top */}
        <form
          onSubmit={handleCreateTodo}
          className="border-b border-slate-200 p-4 bg-slate-50/90 sticky top-0 z-10 shadow-sm"
        >
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={newTodoText}
              onChange={(e) => setNewTodoText(e.target.value)}
              placeholder="Add a new task..."
              className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm placeholder:text-slate-400"
            />
            <button
              type="submit"
              disabled={!newTodoText.trim()}
              className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none shadow-sm transition-colors"
            >
              <Plus size={18} />
              <span className="font-medium">Add Task</span>
            </button>
          </div>
        </form>

        <div className="max-h-[65vh] overflow-y-auto">
          <div className="divide-y divide-slate-200">
            {currentTodos.length === 0 ? (
              <div className="p-10 text-center text-slate-500 bg-slate-50/50">
                <div className="inline-flex p-4 rounded-full bg-slate-100 mb-3">
                  <Plus size={24} className="text-slate-400" />
                </div>
                <p className="font-medium">No items yet</p>
                <p className="text-sm mt-1">Add your first to-do item above</p>
              </div>
            ) : (
              currentTodos.map((todo) => (
                <div
                  key={todo.id}
                  className={`p-4 sm:p-5 transition-colors ${
                    todo.completed ? 'bg-slate-50/80' : 'hover:bg-blue-50/20'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => handleToggleComplete(todo.id)}
                      className={`w-6 h-6 rounded-full flex-shrink-0 border mt-0.5 flex items-center justify-center transition-colors ${
                        todo.completed
                          ? 'bg-green-600 border-green-600 text-white'
                          : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50'
                      }`}
                    >
                      {todo.completed && <Check size={14} />}
                    </button>

                    <div className="flex-1">
                      {editingTodoId === todo.id ? (
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center gap-2">
                            <input
                              ref={editInputRef}
                              type="text"
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSaveEdit(todo.id);
                                } else if (e.key === 'Escape') {
                                  handleCancelEdit();
                                }
                              }}
                            />
                            <button
                              onClick={() => handleSaveEdit(todo.id)}
                              className="p-2 text-green-600 hover:text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                              title="Save"
                            >
                              <Save size={16} />
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="p-2 text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Cancel"
                            >
                              <X size={16} />
                            </button>
                          </div>

                          {/* BlockEditor for editing notes */}
                          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden p-2">
                            <BlockEditor
                              key={`edit-${todo.id}`}
                              data={todo.content || { blocks: [] }}
                              onChange={(data) =>
                                handleEditorChange(todo.id, data)
                              }
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p
                              className={`text-base ${
                                todo.completed
                                  ? 'line-through text-slate-500'
                                  : 'text-slate-800 font-medium'
                              }`}
                            >
                              {todo.text}
                            </p>

                            <div className="flex flex-wrap gap-4 mt-2 text-xs text-slate-500">
                              <span className="flex items-center gap-1">
                                <Clock size={12} />
                                Created: {formatShortDateTime(todo.created_at)}
                              </span>
                              {todo.updated_at !== todo.created_at && (
                                <span className="flex items-center gap-1">
                                  <RefreshCw size={12} />
                                  Updated: {formatShortDateTime(todo.updated_at)}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center ml-4">
                            {shouldShowExpandButton(todo) && (
                              <button
                                onClick={() => toggleTodoExpand(todo.id)}
                                className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-md transition-colors"
                                title={
                                  expandedTodos.has(todo.id)
                                    ? 'Hide notes'
                                    : 'Show notes'
                                }
                              >
                                {expandedTodos.has(todo.id) ? (
                                  <ChevronUp size={16} />
                                ) : (
                                  <ChevronDown size={16} />
                                )}
                              </button>
                            )}
                            {editingTodoId !== todo.id && (
                              <button
                                onClick={() => handleStartEdit(todo)}
                                className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-md transition-colors"
                                title="Edit"
                              >
                                <Edit2 size={16} />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteTodo(todo.id)}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {editingTodoId !== todo.id && expandedTodos.has(todo.id) && (
                    <div className="mt-4 pl-9">
                      <div
                        className="relative border border-slate-200 rounded-lg bg-white shadow-sm"
                        style={{
                          maxHeight: fullNotesTodos.has(todo.id)
                            ? 'none'
                            : '12rem',
                          overflow: fullNotesTodos.has(todo.id)
                            ? 'visible'
                            : 'hidden',
                        }}
                      >
                        <div
                          className="p-2"
                          ref={(el) => (contentRefs.current[todo.id] = el)}
                        >
                          <BlockEditor
                            key={`view-${todo.id}`}
                            data={todo.content || { blocks: [] }}
                            readOnly
                            onChange={() => {}}
                          />
                        </div>

                        {!fullNotesTodos.has(todo.id) && (
                          <div className="z-[50] absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white via-white/80 to-transparent flex justify-center items-end">
                            <button
                              className="pointer-events-auto text-sm text-blue-600 hover:text-blue-700 bg-white px-3 py-1.5 rounded-md shadow hover:shadow-md border border-blue-100 transition-all transform hover:-translate-y-0.5"
                              onClick={() => toggleFullNotes(todo.id)}
                            >
                              Show full notes
                            </button>
                          </div>
                        )}

                        {fullNotesTodos.has(todo.id) && (
                          <div className="z-[50] flex justify-center py-2 border-t border-slate-100">
                            <button
                              className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1 flex items-center gap-1"
                              onClick={() => toggleFullNotes(todo.id)}
                            >
                              <ChevronUp size={14} />
                              Show less
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
        
        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="border-t border-slate-200 p-4 bg-slate-50 flex justify-center">
            <div className="flex items-center gap-1">
              <button
                onClick={() => goToPage(1)}
                disabled={currentPage === 1}
                className="p-1.5 rounded-md text-slate-500 hover:text-blue-600 hover:bg-blue-50 disabled:text-slate-300 disabled:hover:bg-transparent"
              >
                <ChevronLeft size={16} className="rotate-90" />
              </button>
              
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-1.5 rounded-md text-slate-500 hover:text-blue-600 hover:bg-blue-50 disabled:text-slate-300 disabled:hover:bg-transparent"
              >
                <ChevronLeft size={16} />
              </button>
              
              <span className="px-3 py-1 text-sm">
                Page <span className="font-medium text-blue-600">{currentPage}</span> of{" "}
                <span className="font-medium">{totalPages}</span>
              </span>
              
              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-md text-slate-500 hover:text-blue-600 hover:bg-blue-50 disabled:text-slate-300 disabled:hover:bg-transparent"
              >
                <ChevronRight size={16} />
              </button>
              
              <button
                onClick={() => goToPage(totalPages)}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-md text-slate-500 hover:text-blue-600 hover:bg-blue-50 disabled:text-slate-300 disabled:hover:bg-transparent"
              >
                <ChevronRight size={16} className="rotate-90" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TodoList;