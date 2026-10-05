import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect } from 'react'
import { Bold, Italic, Heading1, Heading2, Heading3, List, ListOrdered, Quote } from 'lucide-react'

export interface EditorProps {
  initialContent: any
  onChange: (content: any) => void
}

export function Editor({ initialContent, onChange }: EditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
    ],
    content: initialContent,
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON())
    },
    editorProps: {
      attributes: {
        class: 'prose prose-invert prose-sm sm:prose-base focus:outline-none min-h-[300px] max-w-none leading-relaxed p-4',
      },
    },
  })

  // Watch for external content updates (like selecting a different document)
  useEffect(() => {
    if (editor && initialContent) {
      // In a real app we might check if the content is truly different
    }
  }, [initialContent, editor])

  if (!editor) {
    return null
  }

  return (
    <div className="border border-border-subtle rounded-md bg-slate-900/50 flex flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-1 p-2 border-b border-border-subtle bg-surface-base text-text-muted">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-1.5 rounded transition-colors ${editor.isActive('bold') ? 'bg-primary/20 text-white' : 'hover:bg-surface-floating hover:text-white'}`}
          title="Negrito"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded transition-colors ${editor.isActive('italic') ? 'bg-primary/20 text-white' : 'hover:bg-surface-floating hover:text-white'}`}
          title="Itálico"
        >
          <Italic className="w-4 h-4" />
        </button>
        
        <div className="w-px h-5 bg-border-subtle mx-1" />
        
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`p-1.5 rounded transition-colors ${editor.isActive('heading', { level: 1 }) ? 'bg-primary/20 text-white' : 'hover:bg-surface-floating hover:text-white'}`}
          title="Título 1"
        >
          <Heading1 className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-1.5 rounded transition-colors ${editor.isActive('heading', { level: 2 }) ? 'bg-primary/20 text-white' : 'hover:bg-surface-floating hover:text-white'}`}
          title="Título 2"
        >
          <Heading2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`p-1.5 rounded transition-colors ${editor.isActive('heading', { level: 3 }) ? 'bg-primary/20 text-white' : 'hover:bg-surface-floating hover:text-white'}`}
          title="Título 3"
        >
          <Heading3 className="w-4 h-4" />
        </button>
        
        <div className="w-px h-5 bg-border-subtle mx-1" />
        
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1.5 rounded transition-colors ${editor.isActive('bulletList') ? 'bg-primary/20 text-white' : 'hover:bg-surface-floating hover:text-white'}`}
          title="Lista com Marcadores"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-1.5 rounded transition-colors ${editor.isActive('orderedList') ? 'bg-primary/20 text-white' : 'hover:bg-surface-floating hover:text-white'}`}
          title="Lista Numerada"
        >
          <ListOrdered className="w-4 h-4" />
        </button>
        
        <div className="w-px h-5 bg-border-subtle mx-1" />
        
        <button
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`p-1.5 rounded transition-colors ${editor.isActive('blockquote') ? 'bg-primary/20 text-white' : 'hover:bg-surface-floating hover:text-white'}`}
          title="Citação (Blockquote)"
        >
          <Quote className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 bg-transparent">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
