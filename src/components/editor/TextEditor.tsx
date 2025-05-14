import React, { useState, useEffect, useRef } from 'react';

interface TextEditorProps {
  data: any;
  onChange: (data: any) => void;
  readOnly?: boolean;
}

const TextEditor: React.FC<TextEditorProps> = ({
  data,
  onChange,
  readOnly = false
}) => {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initialize with existing data
  useEffect(() => {
    if (data?.blocks) {
      // Convert blocks to plain text format
      const textContent = data.blocks.map((block: any) => {
        switch (block.type) {
          case 'list':
            return block.data.items
              .map((item: string) => `- ${item}`)
              .join('\n');
          case 'checklist':
            return block.data.items
              .map((item: any) => `[${item.checked ? 'x' : ' '}] ${item.text}`)
              .join('\n');
          case 'paragraph':
            return block.data.text;
          default:
            return '';
        }
      }).join('\n\n');
      setValue(textContent);
    } else {
      setValue('');
    }
  }, [data]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    
    // Convert text back to block format and call onChange
    const lines = newValue.split('\n');
    const blocks = [];

    let currentList: string[] = [];
    let currentChecklist: Array<{text: string, checked: boolean}> = [];

    for (const line of lines) {
      // Detect checklist items
      if (line.match(/^\[(x| )\] .+/)) {
        const checked = line[1] === 'x';
        const text = line.slice(3).trim();
        currentChecklist.push({ text, checked });
        continue;
      }
      
      // Detect list items
      if (line.match(/^[-*] .+/)) {
        currentList.push(line.slice(2).trim());
        continue;
      }

      // Push any accumulated checklist items
      if (currentChecklist.length > 0) {
        blocks.push({
          type: 'checklist',
          data: { items: [...currentChecklist] }
        });
        currentChecklist = [];
      }

      // Push any accumulated list items
      if (currentList.length > 0) {
        blocks.push({
          type: 'list',
          data: { items: [...currentList] }
        });
        currentList = [];
      }

      // Handle regular paragraphs
      if (line.trim()) {
        blocks.push({
          type: 'paragraph',
          data: { text: line }
        });
      }
    }

    // Push any remaining checklist or list items
    if (currentChecklist.length > 0) {
      blocks.push({
        type: 'checklist',
        data: { items: [...currentChecklist] }
      });
    }
    
    if (currentList.length > 0) {
      blocks.push({
        type: 'list',
        data: { items: [...currentList] }
      });
    }

    onChange({ blocks });
  };

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={handleChange}
      readOnly={readOnly}
      className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      style={{ minHeight: '150px' }}
      placeholder={readOnly ? '' : 'Type here...\n\nUse "- " for lists\nUse "[ ]" for checklists'}
    />
  );
};

export default TextEditor;