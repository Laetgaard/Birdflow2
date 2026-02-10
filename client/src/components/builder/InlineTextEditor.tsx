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

/**
 * Places the caret at the position nearest to the click coordinates.
 * Falls back to placing caret at end of element if APIs aren't available.
 */
function placeCaretAtPoint(element: HTMLElement, clientX: number, clientY: number) {
  // Try the standard API first (Firefox, modern browsers)
  if ('caretPositionFromPoint' in document) {
    const pos = (document as any).caretPositionFromPoint(clientX, clientY);
    if (pos) {
      const sel = window.getSelection();
      const range = document.createRange();
      range.setStart(pos.offsetNode, pos.offset);
      range.collapse(true);
      sel?.removeAllRanges();
      sel?.addRange(range);
      return;
    }
  }
  // WebKit/Blink API (Chrome, Safari, Edge)
  if (document.caretRangeFromPoint) {
    const range = document.caretRangeFromPoint(clientX, clientY);
    if (range) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      return;
    }
  }
  // Fallback: place caret at end
  const sel = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  sel?.removeAllRanges();
  sel?.addRange(range);
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
  const justEnteredEditingRef = useRef(false);
  const pendingClickRef = useRef<{ x: number; y: number } | null>(null);

  const isActive = editingTextFieldId === fieldId;

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // When entering edit mode, focus the element and place caret at click position
  useEffect(() => {
    if (isActive && editorRef.current && justEnteredEditingRef.current) {
      justEnteredEditingRef.current = false;
      editorRef.current.focus();

      // Place caret at the double-click position instead of selecting all
      if (pendingClickRef.current) {
        placeCaretAtPoint(editorRef.current, pendingClickRef.current.x, pendingClickRef.current.y);
        pendingClickRef.current = null;
      } else {
        // Fallback: place caret at end
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  }, [isActive]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (!isBuilderMode) return;
    e.stopPropagation();
    e.preventDefault();

    // Save the click position so we can place the caret there
    pendingClickRef.current = { x: e.clientX, y: e.clientY };
    justEnteredEditingRef.current = true;
    setIsEditing(true);
    setEditingTextFieldId(fieldId);
  }, [isBuilderMode, fieldId, setEditingTextFieldId]);

  // When clicking inside while already editing, let the browser handle caret positioning naturally
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (isEditing) {
      // Don't interfere - let the browser place the cursor naturally
      e.stopPropagation();
      return;
    }
  }, [isEditing]);

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
      if (editorRef.current) {
        editorRef.current.textContent = value;
      }
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
      onClick={handleClick}
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
