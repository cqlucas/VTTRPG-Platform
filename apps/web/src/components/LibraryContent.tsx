import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BookOpen, ImageIcon, FileText, MoreVertical, Send, Folder, File, PlusCircle, Search, X } from "lucide-react";
import { SistemasTab } from "./sistemas/SistemasTab";

export function LibraryContent() {
  const [activeTab, setActiveTab] = useState("sistemas");

  return (
    <motion.div 
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="flex flex-col h-full w-full gap-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-primary" />
          Biblioteca
        </h2>
      </div>

      {/* Tabs Menu */}
      <div className="flex items-center gap-2 border-b border-border-subtle pb-px">
        <button
          onClick={() => setActiveTab("sistemas")}
          className={`px-4 py-2.5 text-[13px] font-medium transition-colors border-b-2 ${
            activeTab === "sistemas"
              ? "border-primary text-white"
              : "border-transparent text-text-muted hover:text-white hover:border-border-subtle"
          }`}
        >
          Sistemas & Fichas
        </button>
        <button
          onClick={() => setActiveTab("compendio")}
          className={`px-4 py-2.5 text-[13px] font-medium transition-colors border-b-2 ${
            activeTab === "compendio"
              ? "border-primary text-white"
              : "border-transparent text-text-muted hover:text-white hover:border-border-subtle"
          }`}
        >
          Compêndio (Lore)
        </button>
        <button
          onClick={() => setActiveTab("galeria")}
          className={`px-4 py-2.5 text-[13px] font-medium transition-colors border-b-2 ${
            activeTab === "galeria"
              ? "border-primary text-white"
              : "border-transparent text-text-muted hover:text-white hover:border-border-subtle"
          }`}
        >
          Galeria (Assets)
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden flex flex-col relative">
        {activeTab === "sistemas" && <SistemasTab />}
        {activeTab === "compendio" && <CompendioTab />}
        {activeTab === "galeria" && <GaleriaTab />}
      </div>
    </motion.div>
  );
}

import { useLiveQuery } from "../lib/useLiveQuery";
import { loreRepo } from "../lib/lore";

import { Editor } from "./compendium/Editor";

function EditableTitle({ value, onChange, placeholder = "Sem título", className = "" }: any) {
  const [val, setVal] = useState(value);
  
  useEffect(() => {
    setVal(value);
  }, [value]);

  const handleBlur = () => {
    if (val !== value) onChange(val);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    }
  };

  return (
    <input
      type="text"
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      className={className}
    />
  );
}

function CompendioTab() {
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [draggedDocId, setDraggedDocId] = useState<string | null>(null);
  
  const tree = useLiveQuery(() => loreRepo.listTree(), []);
  
  const handleCreateDocument = async () => {
    const doc = await loreRepo.createDocument({ title: "Novo Documento" });
    setSelectedDocId(doc.id);
  };

  const handleCreateFolder = async () => {
    await loreRepo.createFolder("Nova Pasta", null);
  };

  const selectedDoc = useLiveQuery(
    async () => selectedDocId ? await loreRepo.getDocument(selectedDocId) : null,
    [selectedDocId]
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex h-full border border-border-subtle rounded-lg overflow-hidden bg-surface-dim">
      {/* Master Panel */}
      <div className="w-64 border-r border-border-subtle bg-surface-base flex flex-col">
        <div className="p-4 border-b border-border-subtle flex justify-between items-center">
          <span className="font-medium text-[13px] text-white">Documentos</span>
          <div className="flex gap-2">
            <button onClick={handleCreateFolder} className="text-text-muted hover:text-primary transition-colors" title="Nova Pasta">
              <Folder className="w-4 h-4" />
            </button>
            <button onClick={handleCreateDocument} className="text-text-muted hover:text-primary transition-colors" title="Novo Documento">
              <PlusCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        <div 
          className="flex-1 overflow-y-auto p-2 flex flex-col gap-1 transition-colors relative"
          onDragOver={(e) => { e.preventDefault(); }}
          onDrop={(e) => {
            e.preventDefault();
            // Se soltou direto no fundo da lista, move para raiz (folderId: null)
            if (draggedDocId) {
              loreRepo.moveDocument(draggedDocId, null);
              setDraggedDocId(null);
            }
          }}
        >
          {!tree && <div className="text-text-muted text-[12px] p-2">Carregando...</div>}
          
          {tree?.folders.map(folder => (
            <div 
              key={folder.id} 
              className="group flex items-center justify-between p-2 rounded hover:bg-surface-dim text-white text-[13px] transition-colors"
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.add("bg-primary/20"); }}
              onDragLeave={(e) => { e.currentTarget.classList.remove("bg-primary/20"); }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget.classList.remove("bg-primary/20");
                if (draggedDocId) loreRepo.moveDocument(draggedDocId, folder.id);
                setDraggedDocId(null);
              }}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Folder className="w-4 h-4 text-secondary shrink-0" />
                <EditableTitle 
                  value={folder.name} 
                  onChange={(name: string) => loreRepo.renameFolder(folder.id, name)} 
                  className="bg-transparent outline-none flex-1 truncate"
                />
              </div>
              <button 
                onClick={async (e) => {
                  e.stopPropagation();
                  if (confirm(`Tem certeza que deseja excluir a pasta "${folder.name}"? TUDO que há nela será excluído também.`)) {
                    await loreRepo.deleteFolder(folder.id);
                    if (selectedDoc?.folderId === folder.id) setSelectedDocId(null);
                  }
                }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 text-text-muted transition-all"
                title="Excluir Pasta"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          {tree?.documents.map(doc => (
            <div 
              key={doc.id}
              draggable
              onDragStart={(e) => { setDraggedDocId(doc.id); }}
              onDragEnd={() => setDraggedDocId(null)}
              onClick={() => setSelectedDocId(doc.id)}
              className={`flex items-center justify-between gap-2 p-2 rounded text-[13px] cursor-pointer transition-colors group ${
                selectedDocId === doc.id ? "bg-primary/10 text-primary" : "hover:bg-surface-dim text-text-muted hover:text-white"
              } ${doc.folderId ? "ml-4 border-l border-border-subtle pl-3" : ""}`}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <FileText className="w-4 h-4 shrink-0" />
                <span className="truncate">{doc.title}</span>
              </div>
              
              {doc.folderId && (
                <button 
                  onClick={async (e) => {
                    e.stopPropagation();
                    await loreRepo.moveDocument(doc.id, null);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-text-muted text-text-muted/50 transition-all"
                  title="Remover da Pasta"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
          
          {tree?.folders.length === 0 && tree?.documents.length === 0 && (
            <div className="text-text-muted text-[12px] p-2">Nenhum documento encontrado.</div>
          )}
        </div>
      </div>

      {/* Detail Panel */}
      <div className="flex-1 flex flex-col bg-surface-dim relative">
        {selectedDoc ? (
          <>
            <div className="p-4 border-b border-border-subtle flex justify-end gap-2">
              <button 
                onClick={async () => {
                  if (confirm("Tem certeza que deseja excluir?")) {
                    await loreRepo.deleteDocument(selectedDoc.id);
                    setSelectedDocId(null);
                  }
                }}
                className="flex items-center gap-2 bg-surface-base hover:bg-surface-floating border border-border-subtle text-red-400 hover:text-red-300 px-3 py-1.5 rounded text-[12px] font-medium transition-colors"
              >
                Excluir
              </button>
              <button className="flex items-center gap-2 bg-surface-base hover:bg-surface-floating border border-border-subtle text-white px-3 py-1.5 rounded text-[12px] font-medium transition-colors">
                <Send className="w-3.5 h-3.5" />
                Enviar para Mesa...
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-10 prose prose-invert max-w-none">
              <EditableTitle 
                className="text-3xl font-bold text-white mb-6 bg-transparent outline-none w-full" 
                value={selectedDoc.title}
                onChange={(title: string) => loreRepo.updateDocument(selectedDoc.id, { title })}
                placeholder="Sem título"
              />
              <div className="mt-4">
                <Editor 
                  key={selectedDoc.id} 
                  initialContent={selectedDoc.content} 
                  onChange={(content) => loreRepo.updateDocument(selectedDoc.id, { content })} 
                />
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-text-muted opacity-50">
            <FileText className="w-16 h-16 mb-4" />
            <p>Selecione ou crie um documento para visualizar</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function GaleriaTab() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6 h-full pb-8 overflow-y-auto">
      <div className="flex justify-between items-center">
        <p className="text-text-muted text-[13px]">Gerencie tokens, mapas e ilustrações.</p>
        <button className="bg-surface-base hover:bg-surface-floating border border-border-subtle text-white px-4 py-2 rounded-md font-medium text-[13px] transition-colors flex items-center gap-2">
          <PlusCircle className="w-4 h-4" />
          Fazer Upload
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="aspect-square rounded-lg bg-surface-base border border-border-subtle flex flex-col items-center justify-center text-text-muted hover:border-primary/40 cursor-pointer transition-colors relative group">
            <ImageIcon className="w-8 h-8 opacity-20 group-hover:opacity-100 group-hover:text-primary transition-all mb-2" />
            <span className="text-[10px] font-telemetry uppercase opacity-0 group-hover:opacity-100 transition-opacity">Asset {i}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
