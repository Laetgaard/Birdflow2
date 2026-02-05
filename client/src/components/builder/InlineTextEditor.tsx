import { useState, useRef, useEffect, useCallback } from 'react';
import { useBuilderSelection } from '@/contexts/BuilderSelectionContext';

interface InlineTextEditorProps {
  componentId: string;
  field: string;
  value: string;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span';
}

export default function InlineTextEditor({
  componentId,
  field,
  value,
  className = '',
  style = {},
  placeholder = 'Klik for at redigere...',
  as: Element = 'p',
}: InlineTextEditorProps) {
  const { isBuilderMode, onUpdateComponent, editingTextFieldId, setEditingTextFieldId } = useBuilderSelection();
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const editorRef = useRef<HTMLDivElement>(null);
  const fieldId = `${componentId}-${field}`;
  
  const isActive = editingTextFieldId === fieldId;

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    if (isActive && editorRef.current) {
      editorRef.current.focus();
      // Select all text
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(editorRef.current);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  }, [isActive]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (!isBuilderMode) return;
    e.stopPropagation();
    setIsEditing(true);
    setEditingTextFieldId(fieldId);
  }, [isBuilderMode, fieldId, setEditingTextFieldId]);

  const handleBlur = useCallback(() => {
    if (!isEditing) return;
    
    const newValue = editorRef.current?.textContent || '';
    if (newValue !== value) {
      onUpdateComponent(componentId, { 
        props: { [field]: newValue } 
      });
    }
    setIsEditing(false);
    setEditingTextFieldId(null);
  }, [isEditing, value, componentId, field, onUpdateComponent, setEditingTextFieldId]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setLocalValue(value);
      setIsEditing(false);
      setEditingTextFieldId(null);
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleBlur();
    }
  }, [value, handleBlur, setEditingTextFieldId]);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      setLocalValue(editorRef.current.textContent || '');
    }
  }, []);

  if (!isBuilderMode) {
    return (
      <Element className={className} style={style}>
        {value || placeholder}
      </Element>
    );
  }

  const displayValue = localValue || placeholder;
  const isEmpty = !localValue;

  return (
    <div
      ref={editorRef}
      contentEditable={isEditing}
      suppressContentEditableWarning
      onDoubleClick={handleDoubleClick}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onInput={handleInput}
      className={`${className} ${isEditing ? 'outline-none ring-2 ring-blue-500 ring-offset-2' : ''} ${isEmpty && !isEditing ? 'opacity-50' : ''}`}
      style={{
        ...style,
        cursor: isBuilderMode ? (isEditing ? 'text' : 'pointer') : 'default',
        minHeight: '1em',
        transition: 'box-shadow 0.15s ease',
      }}
      data-testid={`inline-editor-${componentId}-${field}`}
      data-inline-editable="true"
      title={isEditing ? 'Tryk Enter for at gemme, Escape for at annullere' : 'Dobbeltklik for at redigere'}
    >
      {displayValue}
    </div>
  );
}
