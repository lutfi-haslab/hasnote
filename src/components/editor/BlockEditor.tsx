import Quote from '@cychann/editorjs-quote';
import CodeTool from '@editorjs/code';
import EditorJS, { LogLevels } from '@editorjs/editorjs';
import Embed from '@editorjs/embed';
import Header from '@editorjs/header';
import LinkTool from '@editorjs/link';
import EditorjsList from '@editorjs/list';
import Paragraph from '@editorjs/paragraph';
import Table from '@editorjs/table';
import ColorPicker from 'editorjs-color-picker';
import DragDrop from 'editorjs-drag-drop';
import ToggleBlock from 'editorjs-toggle-block';
import Undo from 'editorjs-undo';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import PageLink from '../pages/PageLink';

type BlockEditorProps = {
  data: any;
  readOnly?: boolean;
  onChange?: (data: any) => void;
  autoSave?: boolean;
  isTodo?: boolean;
};

const BlockEditor: React.FC<BlockEditorProps> = ({
  data,
  readOnly = false,
  onChange,
  autoSave = false,
  isTodo = false
}) => {
  const editorRef = useRef<EditorJS | any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef<any>(data);
  const initializedRef = useRef<boolean>(false);
  const [editorKey, setEditorKey] = useState<number>(0);
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


  useEffect(() => {
    dataRef.current = data; // Keep dataRef updated if data prop changes from parent
  }, [data]);

  const handleChange = useCallback(async () => {
    if (!editorRef.current || !onChange) return;

    const performSaveOrGetData = async () => {
      try {
        const savedData = await editorRef?.current.save();
        // Only call onChange if data has actually changed significantly
        // (Editor.js might trigger for minor selection changes etc.)
        // Deep comparison can be expensive. Stringify is a common approach.
        if (JSON.stringify(savedData.blocks) !== JSON.stringify(dataRef.current?.blocks)) {
          dataRef.current = savedData; // Update local ref
          onChange(savedData); // Propagate change to PageDetailPage
        } else if (savedData.blocks.length === 0 && (!dataRef.current?.blocks || dataRef.current.blocks.length > 0)){
          // Handle case where all content is deleted
          dataRef.current = savedData;
          onChange(savedData);
        }
      } catch (error) {
        console.error('Error getting editor data for onChange:', error);
      }
    };

    if (autoSave) { // This 'autoSave' is the prop passed from PageDetailPage
      if (changeTimeoutRef.current) {
        clearTimeout(changeTimeoutRef.current);
      }
      changeTimeoutRef.current = setTimeout(performSaveOrGetData, 1000); // Debounce as before
    } else {
      // If BlockEditor's autoSave prop is false (meaning PageDetailPage's isAutoSave is false),
      // call performSaveOrGetData immediately.
      // PageDetailPage's handleEditorChange will then decide to only cache it locally.
      await performSaveOrGetData();
    }
  }, [onChange, autoSave, dataRef]); // Added autoSave and dataRef to dependencies

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
          // @ts-ignore
          class: Header,
          config: {
            placeholder: 'Enter heading text...',
            levels: [1, 2, 3, 4],
            defaultLevel: 2,
          },
          inlineToolbar: true,
        },
        list: {
                 // @ts-ignore
          class: EditorjsList,
          inlineToolbar: true,
          config: {
            defaultStyle: 'unordered',
          },
        },
        paragraph: {
                 // @ts-ignore
          class: Paragraph,
          inlineToolbar: true,
          config: {
            preserveBlank: true,
          },
        },
        embed: {
                 // @ts-ignore
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
                 // @ts-ignore
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
                 // @ts-ignore
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
                 // @ts-ignore
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
      onChange: isTodo ? onChange : handleChange,
      logLevel: "ERROR" as LogLevels.ERROR,
      onReady: () => {
        new Undo({ editor });
        new DragDrop(editor);
        editorRef.current = editor;

        // Mobile-specific adjustments
        if (isMobile) {
          const editorContainer = containerRef.current;
          if (editorContainer) {
            editorContainer.style.position = 'relative';
            editorContainer.style.zIndex = '1';
          }

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

        // @ts-ignore
        if (containerRef?.current?.childElementCount > 1) {
          setEditorKey((prev) => prev + 1);
          return;
        }

        editorRef.current.isReady
          .then(() => {
            editorRef.current?.render(validData);
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
      <div
        ref={containerRef}
        key={editorKey}
        className="mx-auto max-w-3xl [&_a]:cursor-pointer [&_a]:text-blue-600 [&_a]:underline"
        style={{
          paddingBottom: isMobile ? '60px' : '0',
        }}
      />
    </div>
  );
};

export default BlockEditor;