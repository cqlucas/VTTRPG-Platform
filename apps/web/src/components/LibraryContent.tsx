import { useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, ImageIcon, FileText, MoreVertical, Send, Folder, File, PlusCircle, Search } from "lucide-react";

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

function SistemasTab() {
  const templates = [
    { id: 1, title: "Modelo D&D 5e", desc: "Ficha padrão com atributos e perícias.", date: "Ontem" },
    { id: 2, title: "Ficha de NPC Genérico", desc: "Ficha simplificada para personagens do mestre.", date: "Há 3 dias" },
    { id: 3, title: "Ficha de Monstro", desc: "Template de bloco de estatísticas para combate.", date: "12 Out, 2023" },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6 pb-8 overflow-y-auto">
      <div className="flex justify-between items-center">
        <p className="text-text-muted text-[13px]">Gerencie seus modelos de fichas e estatísticas.</p>
        <button className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-md font-medium text-[13px] transition-colors flex items-center gap-2">
          <PlusCircle className="w-4 h-4" />
          Novo Modelo de Ficha
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((tpl) => (
          <div key={tpl.id} className="p-5 rounded-lg bg-surface-dim border border-border-subtle hover:border-primary/40 transition-colors flex flex-col gap-3 group relative cursor-pointer">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded bg-surface-base border border-border-subtle">
                  <FileText className="w-4 h-4 text-primary" />
                </div>
                <h3 className="font-semibold text-[15px] text-white">{tpl.title}</h3>
              </div>
              <button className="text-text-muted hover:text-white p-1 rounded hover:bg-surface-base transition-colors opacity-0 group-hover:opacity-100">
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>
            
            <p className="text-[12px] text-text-muted mt-2 flex-1">{tpl.desc}</p>
            
            <div className="mt-4 pt-3 border-t border-border-subtle/50 text-[10px] font-telemetry text-text-muted/60 uppercase">
              Modificado: {tpl.date}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function CompendioTab() {
  const [selectedDoc, setSelectedDoc] = useState<string | null>("carta");

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex h-full border border-border-subtle rounded-lg overflow-hidden bg-surface-dim">
      {/* Master Panel */}
      <div className="w-64 border-r border-border-subtle bg-surface-base flex flex-col">
        <div className="p-4 border-b border-border-subtle flex justify-between items-center">
          <span className="font-medium text-[13px] text-white">Documentos</span>
          <button className="text-text-muted hover:text-primary transition-colors" title="Novo Documento">
            <PlusCircle className="w-4 h-4" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
          {/* Mocked Tree */}
          <div className="flex items-center gap-2 p-2 rounded hover:bg-surface-dim text-white text-[13px] cursor-pointer transition-colors">
            <Folder className="w-4 h-4 text-secondary" />
            Reino de Gelo
          </div>
          
          <div className="pl-6 flex items-center gap-2 p-2 rounded hover:bg-surface-dim text-text-muted hover:text-white text-[13px] cursor-pointer transition-colors">
            <File className="w-4 h-4" />
            Facção dos Corvos
          </div>

          <div 
            onClick={() => setSelectedDoc("carta")}
            className={`pl-6 flex items-center gap-2 p-2 rounded text-[13px] cursor-pointer transition-colors ${
              selectedDoc === "carta" ? "bg-primary/10 text-primary" : "hover:bg-surface-dim text-text-muted hover:text-white"
            }`}
          >
            <FileText className="w-4 h-4" />
            Carta do Rei
          </div>
        </div>
      </div>

      {/* Detail Panel */}
      <div className="flex-1 flex flex-col bg-surface-dim relative">
        {selectedDoc === "carta" ? (
          <>
            <div className="p-4 border-b border-border-subtle flex justify-end">
              <button className="flex items-center gap-2 bg-surface-base hover:bg-surface-floating border border-border-subtle text-white px-3 py-1.5 rounded text-[12px] font-medium transition-colors">
                <Send className="w-3.5 h-3.5" />
                Enviar para Mesa...
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-10 prose prose-invert max-w-none">
              <h1 className="text-3xl font-bold text-white mb-6">Carta do Rei</h1>
              <p className="text-text-muted leading-relaxed">
                "Ao nobre emissário da luz,<br/><br/>
                As forças sombrias se reúnem nas fronteiras gélidas do nosso reino. Escrevo-lhe com urgência, pois a Vigília Noturna reportou movimentos de tropas desconhecidas perto do desfiladeiro. 
                Precisamos que reúna os campeões imediatamente."
              </p>
              <p className="text-text-muted leading-relaxed mt-4">
                <em>Selado com cera rubra e o emblema do dragão.</em>
              </p>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-text-muted opacity-50">
            <FileText className="w-16 h-16 mb-4" />
            <p>Selecione um documento para visualizar</p>
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
