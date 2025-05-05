import React, { useEffect, useRef, useState, useCallback } from 'react';
import EditorJS from '@editorjs/editorjs';
import Header from '@editorjs/header';
import EditorjsList from '@editorjs/list';
import Paragraph from '@editorjs/paragraph';
import Embed from '@editorjs/embed';
import Table from '@editorjs/table';
import LinkTool from '@editorjs/link';
import { RotateCcw, Save } from 'lucide-react';
import PageLink from '../pages/PageLink';
import ColorPicker from 'editorjs-color-picker';
import Quote from '@cychann/editorjs-quote';
import ToggleBlock from 'editorjs-toggle-block';
import DragDrop from 'editorjs-drag-drop';
import Undo from 'editorjs-undo';
import CodeTool from '@editorjs/code';

type BlockEditorProps = {
  data: any;
  readOnly?: boolean;
  onChange?: (data: any) => void;
  autoSave?: boolean;
};

const BlockEditor: React.FC<BlockEditorProps> = ({
  data,
  readOnly = false,
  onChange,
  autoSave = false,
}) => {
  const editorRef = useRef<EditorJS | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef<any>(data);
  const initializedRef = useRef<boolean>(false);
  const [editorKey, setEditorKey] = useState<number>(0);
  const [hasChanges, setHasChanges] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const changeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isMobile, setIsMobile] = useState<boolean>(false);

  // Detect mobile on mount
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent
        )
      );
    };
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  // Custom link parser for internal page links
  const customLinkParser = (url: string) => {
    const pageIdMatch = url.match(/\/page\/([a-f0-9-]+)/i);
    if (pageIdMatch) {
      return {
        type: 'page',
        pageId: pageIdMatch[1],
      };
    }
    return null;
  };

  // Custom link renderer
  const renderLink = (data: any) => {
    if (data.type === 'page') {
      return <PageLink pageId={data.pageId} />;
    }
    return null;
  };

  // Save handler
  const handleSave = useCallback(async () => {
    if (!editorRef.current || !onChange || !hasChanges) return;

    setIsSaving(true);
    try {
      const savedData = await editorRef.current.save();
      dataRef.current = savedData;
      onChange(savedData);
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving editor data:', error);
    } finally {
      setIsSaving(false);
    }
  }, [onChange, hasChanges]);

  // Change handler
  const handleChange = useCallback(async () => {
    if (!editorRef.current) return;

    setHasChanges(true);

    if (autoSave && onChange) {
      if (changeTimeoutRef.current) {
        clearTimeout(changeTimeoutRef.current);
      }

      changeTimeoutRef.current = setTimeout(async () => {
        setIsSaving(true);
        try {
          const savedData = await editorRef.current.save();
          if (JSON.stringify(savedData) !== JSON.stringify(dataRef.current)) {
            dataRef.current = savedData;
            onChange(savedData);
            setHasChanges(false);
          }
        } catch (error) {
          console.error('Error saving editor data:', error);
        } finally {
          setIsSaving(false);
        }
      }, 1000);
    }
  }, [onChange, autoSave]);

  // Initialize editor with mobile-specific settings
  useEffect(() => {
    if (!containerRef.current || initializedRef.current) return;

    initializedRef.current = true;

    const validData = data?.blocks ? data : { blocks: [] };
    dataRef.current = validData;

    const editor = new EditorJS({
      holder: containerRef.current,
      minHeight: 0,
      tools: {
        header: {
          class: Header,
          config: {
            placeholder: 'Enter heading text...',
            levels: [1, 2, 3, 4],
            defaultLevel: 2,
          },
          inlineToolbar: true,
        },
        list: {
          class: EditorjsList,
          inlineToolbar: true,
          config: {
            defaultStyle: 'unordered',
          },
        },
        paragraph: {
          class: Paragraph,
          inlineToolbar: true,
          config: {
            preserveBlank: true,
          },
        },
        embed: {
          class: Embed,
          inlineToolbar: true,
          config: {
            services: {
              youtube: true,
              vimeo: true,
            },
          },
        },
        table: {
          class: Table,
          inlineToolbar: true,
          config: {
            withHeadings: true,
          },
        },
        linkTool: {
          class: LinkTool,
          config: {
            endpoint: 'https://next-api-ivory.vercel.app/api/link-tool',
            customParser: (url) => ({
              type: 'link',
              url,
            }),
            customRender: (data) => (
              <a
                href={data.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline"
              >
                {data.url}
              </a>
            ),
          },
        },
        code: CodeTool,
        color: {
          class: ColorPicker,
          config: {
            colorCollections: [
              '#EC7878',
              '#9C27B0',
              '#673AB7',
              '#3F51B5',
              '#0070FF',
              '#03A9F4',
              '#00BCD4',
              '#4CAF50',
            ],
            defaultColor: '#FF1300',
            type: 'text',
          },
        },
        quote: {
          class: Quote,
          config: {
            defaultType: 'quotationMark',
          },
          shortcut: 'CMD+SHIFT+O',
        },
        toggle: {
          class: ToggleBlock,
          inlineToolbar: true,
        },
      },
      data: validData,
      readOnly,
      onChange: handleChange,
      logLevel: 'ERROR',
      onReady: () => {
        new Undo({ editor });
        new DragDrop(editor);
        editorRef.current = editor;

        // Mobile-specific adjustments
        if (isMobile) {
          // Ensure toolbar is visible
          const editorContainer = containerRef.current;
          if (editorContainer) {
            editorContainer.style.position = 'relative';
            editorContainer.style.zIndex = '1';
          }

          // Add touch event listeners to help with toolbar visibility
          document.querySelectorAll('.ce-toolbar').forEach((toolbar) => {
            toolbar.addEventListener('touchstart', (e) => e.stopPropagation());
          });
        }
      },
      i18n: {
        messages: {
          ui: {
            blockTunes: {
              toggler: {
                'Click to tune': 'Tap to tune',
              },
            },
            toolbar: {
              toolbox: {
                Add: 'Add block',
              },
            },
          },
          toolNames: {
            Text: 'Paragraph',
            Heading: 'Heading',
            List: 'List',
            Quote: 'Quote',
            Table: 'Table',
            Link: 'Link',
            Embed: 'Embed',
          },
        },
      },
    });

    return () => {
      if (changeTimeoutRef.current) {
        clearTimeout(changeTimeoutRef.current);
      }
      if (editorRef.current) {
        editorRef.current.destroy();
        editorRef.current = null;
        initializedRef.current = false;
      }
    };
  }, [data, readOnly, handleChange, editorKey, autoSave, isMobile]);

  // Handle external data changes
  useEffect(() => {
    if (!editorRef.current || !editorRef.current.render || !data) return;

    if (JSON.stringify(data) !== JSON.stringify(dataRef.current)) {
      try {
        const validData = data.blocks ? data : { blocks: [] };
        dataRef.current = validData;

        if (containerRef.current?.childElementCount > 1) {
          setEditorKey((prev) => prev + 1);
          return;
        }

        editorRef.current.isReady
          .then(() => {
            editorRef.current?.render(validData);
            setHasChanges(false);
          })
          .catch(console.error);
      } catch (error) {
        console.error('Error rendering new data:', error);
        setEditorKey((prev) => prev + 1);
      }
    }
  }, [data]);

  // Handle readOnly changes
  useEffect(() => {
    if (!editorRef.current || !editorRef.current.readOnly) return;
    editorRef.current.readOnly.toggle(readOnly);
  }, [readOnly]);

  return (
    <div className="relative editorjs-container">
      {!readOnly && !autoSave && (
        <button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className={`fixed z-50 right-4 bottom-[130px] p-3 rounded-full shadow-lg transition-all ${
            hasChanges
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          } ${isSaving ? 'animate-pulse' : ''}`}
          aria-label="Save changes"
          style={{
            touchAction: 'manipulation', // Improve touch responsiveness
          }}
        >
          <Save size={20} />
        </button>
      )}

      <div
        ref={containerRef}
        key={editorKey}
        className="mx-auto max-w-3xl [&_a]:cursor-pointer [&_a]:text-blue-600 [&_a]:underline"
        style={{
          paddingBottom: isMobile ? '60px' : '0', // Add space for mobile keyboard
        }}
      />
    </div>
  );
};

export default BlockEditor;
