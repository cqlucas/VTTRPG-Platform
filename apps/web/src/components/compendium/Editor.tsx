import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useState } from 'react'

export interface EditorProps {
  initialContent: any
  onChange: (content: any) => void
}

export function Editor({ initialContent, onChange }: EditorProps) {
  // To avoid unnecesary re-renders due to Tiptap resetting cursor on prop change,
  // we initialize it once and manually update it if the incoming ID/content changes drastically.
  
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
        class: 'prose prose-invert prose-sm sm:prose-base lg:prose-lg xl:prose-2xl focus:outline-none min-h-[300px]',
      },
    },
  })

  // Watch for external content updates (like selecting a different document)
  useEffect(() => {
    if (editor && initialContent) {
      // Very naive check, in a real app you might compare JSON structure deeply or rely on a "key" prop on the Editor component
      // Here, we just rely on the parent changing the `key` to remount the component.
    }
  }, [initialContent, editor])

  if (!editor) {
    return null
  }

  return (
    <div className="border border-border-subtle rounded-md p-4 bg-surface-base">
      <div className="flex gap-2 mb-4 border-b border-border-subtle pb-2 text-text-muted">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`px-2 py-1 rounded ${editor.isActive('bold') ? 'bg-primary/20 text-white' : 'hover:bg-surface-floating'}`}
        >
          <strong>B</strong>
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`px-2 py-1 rounded ${editor.isActive('italic') ? 'bg-primary/20 text-white' : 'hover:bg-surface-floating'}`}
        >
          <em>I</em>
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`px-2 py-1 rounded ${editor.isActive('heading', { level: 2 }) ? 'bg-primary/20 text-white' : 'hover:bg-surface-floating'}`}
        >
          H2
        </button>
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`px-2 py-1 rounded ${editor.isActive('bulletList') ? 'bg-primary/20 text-white' : 'hover:bg-surface-floating'}`}
        >
          List
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
