import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  List,
  ListOrdered,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { TodoItem } from '../../types'; // Ensure this path is correct
import { formatShortDateTime } from '../../lib/utils'; // Ensure this path is correct
import Spinner from '../ui/Spinner'; // Ensure this path is correct
import { getDB, addToSyncQueue } from '../../lib/db'; // Ensure this path is correct
import toast from 'react-hot-toast';

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
  const [editNotesText, setEditNotesText] = useState(''); // New state for notes textarea

  const [history, setHistory] = useState<TodoHistory[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  
  const [expandedTodos, setExpandedTodos] = useState<Set<string>>(new Set());
  const [fullNotesTodos, setFullNotesTodos] = useState<Set<string>>(new Set());
  const notesViewRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [showFullNotesButton, setShowFullNotesButton] = useState<Record<string, boolean>>({});


  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(5);
  
  const [sortBy, setSortBy] = useState<'created_at' | 'updated_at'>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  const editInputRef = useRef<HTMLInputElement>(null);
  const editNotesAreaRef = useRef<HTMLTextAreaElement>(null);


  const updateHistory = (updatedTodos: TodoItem[]) => {
    setHistory((prevHistory) => [
      ...prevHistory,
      { todos: JSON.parse(JSON.stringify(updatedTodos)), timestamp: Date.now() },
    ]);
  };

  useEffect(() => {
    if (todos.length > 0 && history.length === 0) {
      setHistory([{ todos: JSON.parse(JSON.stringify(todos)), timestamp: Date.now() }]);
    }
  }, [todos, history.length]);

  useEffect(() => {
    if (editingTodoId && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingTodoId]);

  const fetchTodos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const db = await getDB();
      const cachedTodos = await db.getAllFromIndex('todos', 'by-page', pageId);
      
      if (cachedTodos.length > 0) {
        setTodos(cachedTodos as TodoItem[]);
        setLoading(false); // Show cached data quickly
      }

      const { data, error: supabaseError } = await supabase
        .from('todo_items')
        .select('*')
        .eq('page_id', pageId)
        .order(sortBy, { ascending: sortDirection === 'asc' });

      if (supabaseError) throw supabaseError;

      const fetchedTodos = data as TodoItem[];
      setTodos(fetchedTodos);

      const tx = db.transaction('todos', 'readwrite');
      await Promise.all([
        ...fetchedTodos.map((todo) => tx.store.put(todo)),
        tx.done,
      ]);
    } catch (err: any) {
      console.error('Error fetching todos:', err);
      setError(err.message || 'Failed to fetch todos');
    } finally {
      setLoading(false);
    }
  }, [pageId, sortBy, sortDirection]);

  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  useEffect(() => {
    setCanUndo(history.length > 1);
  }, [history]);

  // Check if "Show full notes" button is needed
  useEffect(() => {
    const newShowFullNotesButton: Record<string, boolean> = {};
    currentTodos.forEach(todo => {
      if (expandedTodos.has(todo.id) && !fullNotesTodos.has(todo.id)) {
        const notesViewDiv = notesViewRefs.current[todo.id];
        if (notesViewDiv && notesViewDiv.scrollHeight > notesViewDiv.clientHeight) {
          newShowFullNotesButton[todo.id] = true;
        } else {
          newShowFullNotesButton[todo.id] = false;
        }
      }
    });
    setShowFullNotesButton(newShowFullNotesButton);
  }, [expandedTodos, fullNotesTodos, todos]); // Re-run if currentTodos changes

  const toggleTodoExpand = (id: string) => {
    setExpandedTodos((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
        setFullNotesTodos(current => { // Also collapse full notes view
          const newFullSet = new Set(current);
          newFullSet.delete(id);
          return newFullSet;
        });
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

  const handleCreateTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoText.trim()) return;

    const optimisticTodo: TodoItem = {
      id: crypto.randomUUID(),
      text: newTodoText.trim(),
      completed: false,
      page_id: pageId,
      content: '', // Initialize notes as empty string
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const previousTodos = todos;
    setTodos((prev) => [optimisticTodo, ...prev]);
    updateHistory([optimisticTodo, ...previousTodos]);
    setNewTodoText('');
    setCurrentPage(1); // Reset to first page

    try {
      const db = await getDB();
      await db.add('todos', optimisticTodo);
      await addToSyncQueue('create', 'todos', optimisticTodo);

      if (navigator.onLine) {
        const { data, error: supabaseError } = await supabase
          .from('todo_items')
          .insert(optimisticTodo)
          .select()
          .single();

        if (supabaseError) throw supabaseError;
        // Optionally update local todo with data from supabase if it differs (e.g., db-generated fields)
        setTodos(prev => prev.map(t => t.id === optimisticTodo.id ? data as TodoItem : t));
      }
      toast.success('Todo Created!');
    } catch (err: any) {
      console.error('Error creating todo:', err);
      setError(err.message || 'Failed to create todo');
      setTodos(previousTodos); // Rollback optimistic update
      updateHistory(previousTodos);
    }
  };

  const handleToggleComplete = async (todoId: string) => {
    const todoToUpdate = todos.find((todo) => todo.id === todoId);
    if (!todoToUpdate) return;

    const updatedTodo = {
      ...todoToUpdate,
      completed: !todoToUpdate.completed,
      updated_at: new Date().toISOString(),
    };

    const previousTodos = todos;
    setTodos(todos.map((todo) => (todo.id === todoId ? updatedTodo : todo)));
    updateHistory(todos.map((todo) => (todo.id === todoId ? updatedTodo : todo)));


    try {
      const db = await getDB();
      await db.put('todos', updatedTodo);
      await addToSyncQueue('update', 'todos', updatedTodo);

      if (navigator.onLine) {
        const { error: supabaseError } = await supabase
          .from('todo_items')
          .update({ completed: updatedTodo.completed, updated_at: updatedTodo.updated_at })
          .eq('id', todoId);
        if (supabaseError) throw supabaseError;
      }
      toast.success('Changes saved successfully!');
    } catch (err: any) {
      console.error('Error updating todo:', err);
      setError(err.message || 'Failed to update todo');
      setTodos(previousTodos); // Rollback
      updateHistory(previousTodos);
    }
  };
  
  const handleStartEdit = (todo: TodoItem) => {
    setEditingTodoId(todo.id);
    setEditText(todo.text);
    setEditNotesText(todo.content || ''); // Populate notes for textarea
  };

  const handleCancelEdit = () => {
    setEditingTodoId(null);
    setEditText('');
    setEditNotesText(''); // Clear notes
  };

  const handleSaveEdit = async (todoId: string) => {
    const originalTodo = todos.find((t) => t.id === todoId);
    if (!originalTodo) return;

    const newText = editText.trim();
    const newNotes = editNotesText.trim(); // Get notes from state

    if (newText === originalTodo.text && newNotes === (originalTodo.content || '')) {
      handleCancelEdit();
      return;
    }
    if (!newText) { // Do not allow empty todo text
        setError("Task text cannot be empty.");
        if (editInputRef.current) editInputRef.current.focus();
        return;
    }
    setError(null);


    const updatedTodo: TodoItem = {
      ...originalTodo,
      text: newText,
      content: newNotes, // Save notes
      updated_at: new Date().toISOString(),
    };
    
    const previousTodos = todos;
    setTodos(todos.map((todo) => (todo.id === todoId ? updatedTodo : todo)));
    updateHistory(todos.map((todo) => (todo.id === todoId ? updatedTodo : todo)));
    handleCancelEdit();

    try {
      const db = await getDB();
      await db.put('todos', updatedTodo);
      await addToSyncQueue('update', 'todos', updatedTodo);

      if (navigator.onLine) {
        const { error: supabaseError } = await supabase
          .from('todo_items')
          .update({ text: updatedTodo.text, content: updatedTodo.content, updated_at: updatedTodo.updated_at })
          .eq('id', todoId);
        if (supabaseError) throw supabaseError;
      }
      toast.success('Changes saved successfully!');
    } catch (err: any) {
      console.error('Error updating todo text/notes:', err);
      setError(err.message || 'Failed to update todo');
      setTodos(previousTodos); // Rollback
      updateHistory(previousTodos);
    }
  };

  const handleDeleteTodo = async (todoId: string) => {
    const previousTodos = todos;
    setTodos(todos.filter((todo) => todo.id !== todoId));
    updateHistory(todos.filter((todo) => todo.id !== todoId));

    // Adjust pagination if needed
    const newTotalItems = todos.length - 1;
    if (newTotalItems % itemsPerPage === 0 && currentPage > newTotalItems / itemsPerPage && currentPage > 1) {
        setCurrentPage(prev => prev -1);
    }


    try {
      const db = await getDB();
      await db.delete('todos', todoId);
      await addToSyncQueue('delete', 'todos', { id: todoId });
      toast.error('Todo Deleted!');

      if (navigator.onLine) {
        const { error: supabaseError } = await supabase.from('todo_items').delete().eq('id', todoId);
        if (supabaseError) throw supabaseError;
      }
    } catch (err: any) {
      console.error('Error deleting todo:', err);
      setError(err.message || 'Failed to delete todo');
      setTodos(previousTodos); // Rollback
      updateHistory(previousTodos);
    }
  };

  const handleUndo = async () => {
    if (history.length <= 1) return;

    const newHistory = [...history];
    newHistory.pop(); // Remove current state
    const previousState = newHistory[newHistory.length - 1];
    
    setHistory(newHistory);
    setTodos(previousState.todos); // Optimistic UI update

    try {
        const db = await getDB();
        const tx = db.transaction('todos', 'readwrite');
        // First, clear existing todos for this pageId from IDB to handle deletions correctly
        const existingPageTodos = await db.getAllFromIndex('todos', 'by-page', pageId);
        for (const et of existingPageTodos) {
            if (!previousState.todos.find(pt => pt.id === et.id)) {
                await tx.store.delete(et.id);
            }
        }
        // Then, put all todos from the undone state
        for (const todo of previousState.todos) {
            if (todo.page_id === pageId) { // Ensure we only affect current page's todos
                 await tx.store.put(todo);
            }
        }
        await tx.done;
        
        // Add to sync queue (could be complex, might need to sync entire state or diffs)
        // For simplicity, just re-fetch or mark for full sync
        // @ts-ignore
        await addToSyncQueue('replace_all_for_page', 'todos', { page_id: pageId, todos: previousState.todos });


      if (navigator.onLine) {
        // This could be a batch update to Supabase to reflect the undone state.
        // For simplicity here, we can trigger a re-fetch, or ideally, send batch updates.
        // Example: Delete todos not in previousState, update/insert others.
        // This is complex, so a full re-fetch might be a pragmatic first step.
        await fetchTodos(); 
      }
    } catch (err: any) {
      console.error('Error performing undo:', err);
      setError(err.message || 'Failed to undo');
      // Potentially roll back the undo if DB operations fail significantly
      setHistory(prevHistory => [...prevHistory, {todos: todos, timestamp: Date.now()}]); // Rollback history
      setTodos(history[history.length-1].todos) // Rollback todos
    }
  };

  const shouldShowExpandButton = (todo: TodoItem) => {
    return todo.content;
  };
  
  const sortedTodos = [...todos].sort((a, b) => {
    const valA = a[sortBy] ? new Date(a[sortBy]!).getTime() : 0;
    const valB = b[sortBy] ? new Date(b[sortBy]!).getTime() : 0;
    return sortDirection === 'asc' ? valA - valB : valB - valA;
  });
  
  const totalPages = Math.max(1, Math.ceil(sortedTodos.length / itemsPerPage));
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentTodos = sortedTodos.slice(indexOfFirstItem, indexOfLastItem);
  
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
      setSortDirection('desc');
    }
  };

  // Helper to render notes string with list support
  const renderNotesWithLists = (notes: string | undefined) => {
    if (!notes) return null;
    const lines = notes.split('\n');
    const elements: JSX.Element[] = [];
    let currentListType: 'ul' | 'ol' | null = null;
    let listItems: JSX.Element[] = [];

    const closeCurrentList = () => {
      if (currentListType && listItems.length > 0) {
        if (currentListType === 'ul') {
          elements.push(<ul key={`ul-${elements.length}`} className="list-disc list-inside pl-4 my-1">{listItems}</ul>);
        } else {
          elements.push(<ol key={`ol-${elements.length}`} className="list-decimal list-inside pl-4 my-1">{listItems}</ol>);
        }
      }
      listItems = [];
      currentListType = null;
    };

    lines.forEach((line, index) => {
      const unorderedMatch = line.match(/^(\s*)(?:[-*]|\u2022)\s+(.*)/); // Support spaces before -, *
      const orderedMatch = line.match(/^(\s*)(\d+)\.\s+(.*)/); // Support spaces before 1.

      if (unorderedMatch) {
        if (currentListType !== 'ul') {
          closeCurrentList();
          currentListType = 'ul';
        }
        listItems.push(<li key={`li-${index}`} className="mb-0.5">{unorderedMatch[2]}</li>);
      } else if (orderedMatch) {
        if (currentListType !== 'ol') {
          closeCurrentList();
          currentListType = 'ol';
        }
        listItems.push(<li key={`li-${index}`} className="mb-0.5">{orderedMatch[3]}</li>);
      } else {
        closeCurrentList();
        if (line.trim() !== '') {
          elements.push(<p key={`p-${index}`} className="my-1">{line}</p>);
        } else {
          // Preserve empty lines between paragraphs essentially as a <br> effect if desired
          // Or simply push a placeholder that results in some space, or ignore.
           elements.push(<br key={`br-${index}`} />); 
        }
      }
    });
    closeCurrentList(); // Ensure any trailing list is closed
    return elements;
  };


  if (loading && todos.length === 0) { // Only show full page spinner if no data yet
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
        {/* Header */}
        <div className="flex justify-between items-center px-5 py-3 bg-gradient-to-r from-blue-50 to-slate-50 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <List size={18} className="text-blue-500" />
            Tasks
            <span className="text-xs font-normal text-slate-500">
              ({todos.length} {todos.length === 1 ? 'item' : 'items'})
            </span>
          </h3>
          <div className="flex items-center gap-2">
            <div className="flex text-xs">
              {/* Sort Buttons */}
              <button 
                onClick={() => changeSortField('created_at')} 
                className={`px-2 py-1 border border-r-0 rounded-l-md flex items-center gap-1 ${
                  sortBy === 'created_at' 
                    ? 'bg-blue-100 border-blue-300 text-blue-800' 
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <CalendarDays size={12} /> Created
                {sortBy === 'created_at' && (sortDirection === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
              </button>
              <button 
                onClick={() => changeSortField('updated_at')} 
                className={`px-2 py-1 border rounded-r-md flex items-center gap-1 ${
                  sortBy === 'updated_at' 
                    ? 'bg-blue-100 border-blue-300 text-blue-800' 
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <RefreshCw size={12} /> Updated
                {sortBy === 'updated_at' && (sortDirection === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
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
        
        {/* Add task form */}
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

        {/* Todo List Area */}
        <div className="max-h-[calc(100vh-280px)] min-h-[200px] overflow-y-auto"> {/* Adjusted max-height */}
          <div className="divide-y divide-slate-200">
            {currentTodos.length === 0 && !loading ? (
              <div className="p-10 text-center text-slate-500 bg-slate-50/50">
                <div className="inline-flex p-4 rounded-full bg-slate-100 mb-3">
                  <ListOrdered size={24} className="text-slate-400" />
                </div>
                <p className="font-medium">No tasks yet</p>
                <p className="text-sm mt-1">Add your first task using the form above.</p>
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
                    {/* Checkbox */}
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

                    <div className="flex-1 min-w-0"> {/* Added min-w-0 for better text wrapping */}
                      {editingTodoId === todo.id ? (
                        // Editing State
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center gap-2">
                            <input
                              ref={editInputRef}
                              type="text"
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) { // Allow Shift+Enter for newline in textarea
                                  e.preventDefault();
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
                          
                          {/* Textarea for Notes */}
                          <textarea
                            ref={editNotesAreaRef}
                            value={editNotesText}
                            onChange={(e) => setEditNotesText(e.target.value)}
                            placeholder="Add notes... (e.g., - item 1, 1. item 2)"
                            className="w-full min-h-[80px] p-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm text-sm"
                            rows={3}
                          />
                        </div>
                      ) : (
                        // Viewing State
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0"> {/* Added min-w-0 */}
                            <p
                              className={`text-base break-words ${ // Added break-words
                                todo.completed
                                  ? 'line-through text-slate-500'
                                  : 'text-slate-800 font-medium'
                              }`}
                            >
                              {todo.text}
                            </p>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
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

                          <div className="flex items-center ml-2 sm:ml-4 flex-shrink-0">
                            {shouldShowExpandButton(todo) && (
                              <button
                                onClick={() => toggleTodoExpand(todo.id)}
                                className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-md transition-colors"
                                title={expandedTodos.has(todo.id) ? 'Hide notes' : 'Show notes'}
                              >
                                {expandedTodos.has(todo.id) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </button>
                            )}
                            <button
                              onClick={() => handleStartEdit(todo)}
                              className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-md transition-colors"
                              title="Edit"
                            >
                              <Edit2 size={16} />
                            </button>
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

                  {/* Display Notes Area (Not in Edit Mode) */}
                  {editingTodoId !== todo.id && expandedTodos.has(todo.id) && shouldShowExpandButton(todo) && (
                    <div className="mt-4 pl-9">
                      <div
                        className="relative border border-slate-200 rounded-lg bg-white shadow-inner p-3 text-sm text-slate-700"
                         style={{
                          maxHeight: fullNotesTodos.has(todo.id) ? 'none' : '10rem', // 160px
                          overflowY: 'hidden', // scroll handled by button logic
                        }}
                        ref={el => notesViewRefs.current[todo.id] = el}
                      >
                        <div className="prose prose-sm max-w-none"> {/* Using prose for better typography */}
                            {renderNotesWithLists(JSON.stringify(todo.content))}
                        </div>

                        {!fullNotesTodos.has(todo.id) && showFullNotesButton[todo.id] && (
                           <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white via-white/90 to-transparent flex justify-center items-end pb-1">
                            <button
                              className="text-xs text-blue-600 hover:text-blue-700 bg-white px-2.5 py-1 rounded-md shadow hover:shadow-md border border-blue-100 transition-all transform hover:-translate-y-0.5"
                              onClick={() => toggleFullNotes(todo.id)}
                            >
                              Show full notes
                            </button>
                          </div>
                        )}
                      </div>
                      {fullNotesTodos.has(todo.id) && (
                        <div className="flex justify-center pt-2">
                          <button
                            className="text-xs text-slate-500 hover:text-slate-700 px-3 py-1 flex items-center gap-1 bg-slate-50 hover:bg-slate-100 rounded-md border border-slate-200"
                            onClick={() => toggleFullNotes(todo.id)}
                          >
                            <ChevronUp size={12} />
                            Show less
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
             {loading && todos.length > 0 && <div className="p-4 text-center text-sm text-slate-500"> <Spinner size="sm" /> Loading more...</div>}
          </div>
        </div>
        
        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="border-t border-slate-200 p-3 bg-slate-50 flex justify-center">
            <div className="flex items-center gap-1">
              <button
                onClick={() => goToPage(1)}
                disabled={currentPage === 1}
                className="p-1.5 rounded-md text-slate-500 hover:text-blue-600 hover:bg-blue-50 disabled:text-slate-300 disabled:hover:bg-transparent" title="First page"
              >
                <ChevronLeft size={16} className="rotate-90 scale-y-150" /> {/* Custom first page icon */}
              </button>
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-1.5 rounded-md text-slate-500 hover:text-blue-600 hover:bg-blue-50 disabled:text-slate-300 disabled:hover:bg-transparent" title="Previous page"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="px-3 py-1 text-xs sm:text-sm">
                Page <span className="font-medium text-blue-600">{currentPage}</span> of{" "}
                <span className="font-medium">{totalPages}</span>
              </span>
              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-md text-slate-500 hover:text-blue-600 hover:bg-blue-50 disabled:text-slate-300 disabled:hover:bg-transparent" title="Next page"
              >
                <ChevronRight size={16} />
              </button>
              <button
                onClick={() => goToPage(totalPages)}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-md text-slate-500 hover:text-blue-600 hover:bg-blue-50 disabled:text-slate-300 disabled:hover:bg-transparent" title="Last page"
              >
                 <ChevronRight size={16} className="rotate-90 scale-y-150" /> {/* Custom last page icon */}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TodoList;