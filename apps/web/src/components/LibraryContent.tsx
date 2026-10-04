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
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);

  const templates = [
    { id: 1, title: "Modelo D&D 5e", desc: "Ficha padrão com atributos e perícias.", date: "Ontem" },
    { id: 2, title: "Ficha de NPC Genérico", desc: "Ficha simplificada para personagens do mestre.", date: "Há 3 dias" },
    { id: 3, title: "Ficha de Monstro", desc: "Template de bloco de estatísticas para combate.", date: "12 Out, 2023" },
  ];

  if (selectedTemplate !== null) {
    const template = templates.find((t) => t.id === selectedTemplate) || templates[0];

    return (
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col gap-6 h-full pb-8">
        {/* Header da Ficha */}
        <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSelectedTemplate(null)}
              className="p-2 rounded hover:bg-surface-dim text-text-muted hover:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                {template.title}
              </h2>
              <p className="text-[12px] text-text-muted mt-1">{template.desc}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button className="bg-surface-dim hover:bg-surface-base border border-border-subtle text-white px-4 py-2 rounded text-[12px] font-medium transition-colors">
              Exportar JSON
            </button>
            <button className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded text-[12px] font-medium transition-colors flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
              Editar Estrutura
            </button>
          </div>
        </div>

        {/* Preview Estrutura Mockada */}
        <div className="flex-1 overflow-y-auto">
          <div className="bg-surface-base border border-border-subtle rounded-lg p-6 max-w-4xl mx-auto flex flex-col gap-8 shadow-sm">
            {/* Cabecalho da Ficha */}
            <div className="grid grid-cols-3 gap-4 border-b border-border-subtle pb-6">
              <div className="col-span-3 lg:col-span-1">
                <div className="w-32 h-32 bg-surface-dim border-2 border-dashed border-border-subtle rounded flex items-center justify-center text-text-muted/50 mb-2">Avatar</div>
              </div>
              <div className="col-span-3 lg:col-span-2 grid grid-cols-2 gap-4">
                <div className="bg-surface-dim rounded p-3 border border-border-subtle"><div className="text-[10px] text-text-muted uppercase">Nome do Personagem</div><div className="h-6 mt-1 bg-surface-base rounded w-3/4"></div></div>
                <div className="bg-surface-dim rounded p-3 border border-border-subtle"><div className="text-[10px] text-text-muted uppercase">Raça / Classe</div><div className="h-6 mt-1 bg-surface-base rounded w-full"></div></div>
                <div className="bg-surface-dim rounded p-3 border border-border-subtle"><div className="text-[10px] text-text-muted uppercase">Nível</div><div className="h-6 mt-1 bg-surface-base rounded w-1/4"></div></div>
                <div className="bg-surface-dim rounded p-3 border border-border-subtle"><div className="text-[10px] text-text-muted uppercase">Alinhamento</div><div className="h-6 mt-1 bg-surface-base rounded w-2/4"></div></div>
              </div>
            </div>

            {/* Corpo da Ficha */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Coluna Esquerda: Atributos */}
              <div className="flex flex-col gap-3">
                <h3 className="text-[13px] font-bold text-white uppercase tracking-wider mb-2 border-b border-primary/30 pb-1">Atributos Principais</h3>
                {['Força', 'Destreza', 'Constituição', 'Inteligência', 'Sabedoria', 'Carisma'].map((attr) => (
                  <div key={attr} className="flex items-center justify-between bg-surface-dim border border-border-subtle rounded p-2">
                    <span className="text-[12px] font-medium text-text-muted">{attr}</span>
                    <div className="flex gap-2">
                      <div className="w-10 h-8 bg-surface-base rounded flex items-center justify-center border border-border-subtle/50 text-white font-bold text-[13px]">10</div>
                      <div className="w-10 h-8 bg-surface-base rounded flex items-center justify-center border border-border-subtle/50 text-text-muted text-[11px]">+0</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Coluna Central e Direita: Perícias e Informações */}
              <div className="lg:col-span-2 flex flex-col gap-6">
                <div>
                  <h3 className="text-[13px] font-bold text-white uppercase tracking-wider mb-3 border-b border-secondary/30 pb-1">Status Vital</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-surface-dim rounded p-4 border border-border-subtle text-center">
                      <div className="text-[11px] text-text-muted uppercase mb-1">Pontos de Vida</div>
                      <div className="text-xl font-bold text-white">-- / --</div>
                    </div>
                    <div className="bg-surface-dim rounded p-4 border border-border-subtle text-center">
                      <div className="text-[11px] text-text-muted uppercase mb-1">Classe de Armadura</div>
                      <div className="text-xl font-bold text-white">--</div>
                    </div>
                    <div className="bg-surface-dim rounded p-4 border border-border-subtle text-center">
                      <div className="text-[11px] text-text-muted uppercase mb-1">Iniciativa</div>
                      <div className="text-xl font-bold text-white">+0</div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-[13px] font-bold text-white uppercase tracking-wider mb-3 border-b border-border-subtle pb-1">Características Dinâmicas (A definir)</h3>
                  <div className="h-32 bg-surface-dim border border-border-subtle border-dashed rounded flex flex-col items-center justify-center text-text-muted/50 gap-2">
                    <PlusCircle className="w-6 h-6" />
                    <span className="text-[12px]">Área reservada para campos dinâmicos customizados</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6 pb-8 overflow-y-auto h-full">
      <div className="flex justify-between items-center">
        <p className="text-text-muted text-[13px]">Gerencie seus modelos de fichas e estatísticas.</p>
        <button className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-md font-medium text-[13px] transition-colors flex items-center gap-2">
          <PlusCircle className="w-4 h-4" />
          Novo Modelo de Ficha
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((tpl) => (
          <div 
            key={tpl.id} 
            onClick={() => setSelectedTemplate(tpl.id)}
            className="p-5 rounded-lg bg-surface-dim border border-border-subtle hover:border-primary/40 transition-colors flex flex-col gap-3 group relative cursor-pointer"
          >
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded bg-surface-base border border-border-subtle">
                  <FileText className="w-4 h-4 text-primary" />
                </div>
                <h3 className="font-semibold text-[15px] text-white group-hover:text-primary transition-colors">{tpl.title}</h3>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); /* mock menu action */ }} 
                className="text-text-muted hover:text-white p-1 rounded hover:bg-surface-base transition-colors opacity-0 group-hover:opacity-100"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>
            
            <p className="text-[12px] text-text-muted mt-2 flex-1">{tpl.desc}</p>
            
            <div className="mt-4 pt-3 border-t border-border-subtle/50 text-[10px] font-telemetry text-text-muted/60 uppercase flex justify-between items-center">
              <span>Modificado: {tpl.date}</span>
              <span className="text-primary opacity-0 group-hover:opacity-100 transition-opacity">Ver Ficha &rarr;</span>
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
