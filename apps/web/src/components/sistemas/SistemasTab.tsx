import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { FileText, MoreVertical, PlusCircle, Save, Trash2, Edit2, Play, Settings, Plus, HelpCircle, X, GripVertical, Download, Upload, Copy, Check, User, Sparkles } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { SheetTemplatesRepository, type SheetTemplate, type SheetTab, type SheetGroup, type SheetField } from "@questdreamer/local-db";
import { useLiveQuery } from "../../lib/useLiveQuery";
import { evaluateFormula } from "../../lib/formula";

export function SistemasTab() {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [forceEditMode, setForceEditMode] = useState(false);

  // Import states
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importTab, setImportTab] = useState<"json" | "pdf">("json");
  const [jsonInput, setJsonInput] = useState("");
  const [importError, setImportError] = useState("");

  const templates = useLiveQuery(() => SheetTemplatesRepository.listTemplates(), []) || [];

  const handleCreateNew = async () => {
    const newTpl = await SheetTemplatesRepository.createTemplate({
      title: "Nova Ficha",
      description: "Descreva o modelo...",
      tabs: [{ id: "tab-1", name: "Principal", groups: [] }]
    });
    setSelectedTemplateId(newTpl.id);
  };

  const handleImportJson = async () => {
    try {
      setImportError("");
      const data = JSON.parse(jsonInput);
      if (!data.title || !Array.isArray(data.tabs)) throw new Error("JSON inválido: Estrutura incompatível.");

      const newTpl = await SheetTemplatesRepository.createTemplate({
        title: data.title,
        description: data.description || "",
        tabs: data.tabs
      });
      setIsImportOpen(false);
      setForceEditMode(false);
      setSelectedTemplateId(newTpl.id);
    } catch (e: any) {
      setImportError(e.message);
    }
  };

  const handleFileUploadJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setJsonInput(ev.target?.result as string);
    };
    reader.readAsText(file);
  };

  const handleImportPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;
      setImportError("Lendo PDF...");

      const buffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(buffer);
      const form = pdfDoc.getForm();
      const fields = form.getFields();

      const mappedFields: SheetField[] = fields.map((f, idx) => {
        const name = f.getName() || `field_${idx}`;
        let type: "text" | "int" | "float" | "checkbox" = "text";
        try {
          if (f.constructor.name.includes("PDFTextField")) {
            const text = (f as any).getText() || "";
            if (text && !isNaN(Number(text))) {
              type = text.includes('.') ? "float" : "int";
            }
          } else if (f.constructor.name.includes("PDFCheckBox")) {
            type = "checkbox";
          }
        } catch (err) { }

        const safeId = name.replace(/[^a-zA-Z0-9_]/g, '');
        return {
          id: safeId || `f_${idx}`,
          label: name,
          type,
          readonlyId: true
        };
      });

      const newTpl = await SheetTemplatesRepository.createTemplate({
        title: file.name.replace('.pdf', ''),
        description: "Importado via extração de PDF. Organize os campos nas abas e grupos.",
        tabs: [{
          id: "tab-raw",
          name: "Importação Bruta",
          groups: [{
            id: "group-raw",
            title: "Campos do PDF",
            width: 3,
            fields: mappedFields
          }]
        }]
      });

      setIsImportOpen(false);
      setForceEditMode(true);
      setSelectedTemplateId(newTpl.id);
    } catch (e: any) {
      setImportError(e.message || "Erro ao ler PDF.");
    }
  };

  if (selectedTemplateId) {
    return <SheetTemplateView templateId={selectedTemplateId} forceEdit={forceEditMode} onBack={() => { setSelectedTemplateId(null); setForceEditMode(false); }} />;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6 pb-8 overflow-y-auto h-full">
      <div className="flex justify-between items-center">
        <p className="text-text-muted text-[13px]">Gerencie seus modelos de fichas e estatísticas.</p>
        <div className="flex gap-2">
          <button
            onClick={() => setIsImportOpen(true)}
            className="bg-surface-base hover:bg-surface-dim border border-border-subtle text-white px-4 py-2 rounded-md font-medium text-[13px] transition-colors flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Importar Modelo
          </button>
          <button
            onClick={handleCreateNew}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-md font-medium text-[13px] transition-colors flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            Novo Modelo
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((tpl) => (
          <div
            key={tpl.id}
            onClick={() => setSelectedTemplateId(tpl.id)}
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
                onClick={async (e) => {
                  e.stopPropagation();
                  if (confirm("Excluir este modelo?")) {
                    await SheetTemplatesRepository.deleteTemplate(tpl.id);
                  }
                }}
                className="text-danger hover:text-white p-1 rounded hover:bg-danger/20 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[12px] text-text-muted mt-2 flex-1">{tpl.description}</p>

            <div className="mt-4 pt-3 border-t border-border-subtle/50 text-[10px] font-telemetry text-text-muted/60 uppercase flex justify-between items-center">
              <span>Modificado: {new Date(tpl.updatedAt).toLocaleDateString()}</span>
              <span className="text-primary opacity-0 group-hover:opacity-100 transition-opacity">Ver Ficha &rarr;</span>
            </div>
          </div>
        ))}
      </div>

      {isImportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-surface-base border border-border-subtle rounded-lg shadow-2xl w-full max-w-lg flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border-subtle bg-surface-dim">
              <h3 className="text-[14px] font-bold text-white flex items-center gap-2">
                <Upload className="w-4 h-4 text-primary" />
                Importar Modelo
              </h3>
              <button onClick={() => setIsImportOpen(false)} className="text-text-muted hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex border-b border-border-subtle bg-surface-dim">
              <button
                onClick={() => { setImportTab('json'); setImportError(""); }}
                className={`flex-1 py-3 text-[13px] font-medium border-b-2 transition-colors ${importTab === 'json' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-white'}`}
              >
                Importar JSON
              </button>
              <button
                onClick={() => { setImportTab('pdf'); setImportError(""); }}
                className={`flex-1 py-3 text-[13px] font-medium border-b-2 transition-colors ${importTab === 'pdf' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-white'}`}
              >
                Extrair de PDF
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4">
              {importError && (
                <div className="p-3 rounded bg-danger/10 border border-danger/20 text-danger text-[12px]">
                  {importError}
                </div>
              )}

              {importTab === 'json' && (
                <>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[12px] font-medium text-text-muted">Cole o JSON do modelo abaixo:</label>
                    <label className="text-[11px] text-primary hover:underline cursor-pointer">
                      ou selecione um arquivo
                      <input type="file" accept=".json" className="hidden" onChange={handleFileUploadJson} />
                    </label>
                  </div>
                  <textarea
                    value={jsonInput}
                    onChange={e => setJsonInput(e.target.value)}
                    className="w-full h-48 bg-background border border-border-subtle rounded p-3 text-[12px] text-white font-mono focus:outline-none focus:border-primary resize-none"
                    placeholder="{"
                  />
                  <div className="flex justify-end mt-2">
                    <button onClick={handleImportJson} className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded text-[13px] font-medium transition-colors">
                      Importar JSON
                    </button>
                  </div>
                </>
              )}

              {importTab === 'pdf' && (
                <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-border-subtle rounded-lg bg-surface-dim text-center">
                  <FileText className="w-12 h-12 text-text-muted mb-4" />
                  <h4 className="text-[14px] font-medium text-white mb-2">Envie um PDF Preenchível (AcroForm)</h4>
                  <p className="text-[12px] text-text-muted mb-6">Nós iremos extrair todos os campos do formulário para criar um modelo bruto, que você poderá organizar depois no Construtor.</p>

                  <label className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-lg text-[13px] font-medium transition-colors cursor-pointer inline-flex items-center gap-2 shadow-sm">
                    <Upload className="w-4 h-4" /> Escolher PDF
                    <input type="file" accept=".pdf" className="hidden" onChange={handleImportPdf} />
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function SheetTemplateView({ templateId, onBack, forceEdit = false }: { templateId: string, onBack: () => void, forceEdit?: boolean }) {
  const [isEditing, setIsEditing] = useState(forceEdit);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [template, setTemplate] = useState<SheetTemplate | null>(null);
  const [backupTemplate, setBackupTemplate] = useState<SheetTemplate | null>(null);

  // Drag and drop states
  const [dragSource, setDragSource] = useState<{ tab: number, group: number } | null>(null);
  const [dragTarget, setDragTarget] = useState<{ tab: number, group: number } | null>(null);

  const [activeTabId, setActiveTabId] = useState<string>("appearance");

  // Appearance mock states
  const [avatarImg, setAvatarImg] = useState<string>("");
  const [tokenImg, setTokenImg] = useState<string>("");
  const [avatarInputType, setAvatarInputType] = useState<"url" | "upload" | "ai">("url");
  const [tokenInputType, setTokenInputType] = useState<"url" | "upload" | "ai">("url");
  const [tempAvatarUrl, setTempAvatarUrl] = useState(avatarImg);
  const [tempTokenUrl, setTempTokenUrl] = useState(tokenImg);

  // Sheet mock values state for preview (View Mode)
  const [formValues, setFormValues] = useState<Record<string, number | string>>({});

  useEffect(() => {
    SheetTemplatesRepository.getTemplate(templateId).then(t => {
      if (t) setTemplate(t);
    });
  }, [templateId]);

  useEffect(() => {
    if (template && forceEdit && !isEditing) {
      if (!backupTemplate) setBackupTemplate(JSON.parse(JSON.stringify(template)));
      setIsEditing(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template, forceEdit]);

  if (!template) return <div>Carregando...</div>;

  const saveTemplate = (updated: SheetTemplate) => {
    setTemplate(updated);
  };

  const startEditing = () => {
    if (template) setBackupTemplate(JSON.parse(JSON.stringify(template)));
    setIsEditing(true);
  };

  const commitChanges = async () => {
    if (!template) return;
    await SheetTemplatesRepository.updateTemplate(template.id, {
      title: template.title,
      description: template.description,
      tabs: template.tabs
    });
    setBackupTemplate(null);
    setIsEditing(false);
  };

  const cancelChanges = () => {
    if (backupTemplate) {
      setTemplate(backupTemplate);
    }
    setBackupTemplate(null);
    setIsEditing(false);
  };

  const handleUpdateField = (tabIndex: number, groupIndex: number, fieldIndex: number, newField: SheetField) => {
    const newTabs = [...template.tabs];
    newTabs[tabIndex].groups[groupIndex].fields[fieldIndex] = newField;
    saveTemplate({ ...template, tabs: newTabs });
  };

  const handleAddField = (tabIndex: number, groupIndex: number) => {
    const newTabs = [...template.tabs];
    newTabs[tabIndex].groups[groupIndex].fields.push({
      id: `field_${Date.now()}`,
      label: "Novo Campo",
      type: "int"
    });
    saveTemplate({ ...template, tabs: newTabs });
  };

  const handleAddGroup = (tabIndex: number) => {
    const newTabs = [...template.tabs];
    newTabs[tabIndex].groups.push({
      id: `group_${Date.now()}`,
      title: "Novo Grupo",
      fields: []
    });
    saveTemplate({ ...template, tabs: newTabs });
  };

  const handleDeleteField = (tabIndex: number, groupIndex: number, fieldIndex: number) => {
    const newTabs = [...template.tabs];
    newTabs[tabIndex].groups[groupIndex].fields.splice(fieldIndex, 1);
    saveTemplate({ ...template, tabs: newTabs });
  };

  const handleDeleteGroup = (tabIndex: number, groupIndex: number) => {
    const newTabs = [...template.tabs];
    newTabs[tabIndex].groups.splice(groupIndex, 1);
    saveTemplate({ ...template, tabs: newTabs });
  };

  const handleAddTab = () => {
    const newId = `tab_${Date.now()}`;
    const newTabs = [...template.tabs];
    newTabs.push({
      id: newId,
      name: "Nova Aba",
      groups: []
    });
    saveTemplate({ ...template, tabs: newTabs });
    setActiveTabId(newId);
  };

  const handleDeleteTab = (tabIndex: number) => {
    const newTabs = [...template.tabs];
    const tabId = newTabs[tabIndex].id;
    newTabs.splice(tabIndex, 1);
    saveTemplate({ ...template, tabs: newTabs });
    if (activeTabId === tabId) setActiveTabId("appearance");
  };

  const handleDragStart = (e: React.DragEvent, tabIdx: number, groupIdx: number) => {
    if (!isEditing) return;
    e.dataTransfer.effectAllowed = "move";
    setDragSource({ tab: tabIdx, group: groupIdx });
  };

  const handleDragOver = (e: React.DragEvent, tabIdx: number, groupIdx: number) => {
    e.preventDefault();
    if (!isEditing || !dragSource || dragSource.tab !== tabIdx) return;
    if (dragTarget?.group !== groupIdx) {
      setDragTarget({ tab: tabIdx, group: groupIdx });
    }
  };

  const handleDrop = (e: React.DragEvent, tabIdx: number, groupIdx: number) => {
    e.preventDefault();
    if (!isEditing || !dragSource || dragSource.tab !== tabIdx) {
      setDragTarget(null);
      setDragSource(null);
      return;
    }

    if (dragSource.group !== groupIdx) {
      const newTabs = [...template.tabs];
      const groupList = Array.from(newTabs[tabIdx].groups);
      const [moved] = groupList.splice(dragSource.group, 1);
      groupList.splice(groupIdx, 0, moved);
      newTabs[tabIdx].groups = groupList;
      saveTemplate({ ...template, tabs: newTabs });
    }

    setDragTarget(null);
    setDragSource(null);
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col gap-6 h-full pb-8">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 rounded hover:bg-surface-dim text-text-muted hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <div>
            {isEditing ? (
              <input
                type="text"
                value={template.title}
                onChange={e => saveTemplate({ ...template, title: e.target.value })}
                className="text-xl font-bold bg-transparent border-b border-border-subtle text-white focus:outline-none focus:border-primary mb-1"
              />
            ) : (
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                {template.title}
              </h2>
            )}

            {isEditing ? (
              <input
                type="text"
                value={template.description}
                onChange={e => saveTemplate({ ...template, description: e.target.value })}
                className="text-[12px] text-text-muted bg-transparent border-b border-border-subtle w-full focus:outline-none focus:border-primary"
              />
            ) : (
              <p className="text-[12px] text-text-muted mt-1">{template.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                onClick={cancelChanges}
                className="bg-transparent border border-border-subtle hover:bg-surface-dim text-text-muted hover:text-white px-4 py-2 rounded text-[12px] font-medium transition-colors flex items-center gap-2"
              >
                <X className="w-4 h-4" /> Cancelar
              </button>
              <button
                onClick={commitChanges}
                className="bg-success hover:bg-success/90 text-primary-foreground px-4 py-2 rounded text-[12px] font-medium transition-colors flex items-center gap-2"
              >
                <Save className="w-4 h-4" /> Finalizar Edição
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsExportOpen(true)}
                className="bg-transparent border border-border-subtle hover:bg-surface-dim text-text-muted hover:text-white px-4 py-2 rounded text-[12px] font-medium transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" /> Exportar JSON
              </button>
              <button
                onClick={startEditing}
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded text-[12px] font-medium transition-colors flex items-center gap-2"
              >
                <Edit2 className="w-4 h-4" /> Editar Estrutura
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto flex flex-col gap-0 pb-8">
          {/* Tab Navigation */}
          <div className="flex gap-2 border-b border-border-subtle overflow-x-auto">
            <button
              onClick={() => setActiveTabId("appearance")}
              className={`px-4 py-3 text-[13px] font-bold rounded-t-lg transition-colors border-b-2 ${activeTabId === 'appearance' ? 'bg-surface-base text-primary border-primary' : 'border-transparent text-text-muted hover:text-white hover:bg-surface-base/50'}`}
            >
              Aparência
            </button>
            {template.tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`px-4 py-3 text-[13px] font-bold rounded-t-lg transition-colors border-b-2 ${activeTabId === tab.id ? 'bg-surface-base text-primary border-primary' : 'border-transparent text-text-muted hover:text-white hover:bg-surface-base/50'}`}
              >
                {tab.name}
              </button>
            ))}
            {isEditing && (
              <button onClick={handleAddTab} className="px-3 py-3 text-text-muted hover:text-white border-b-2 border-transparent">
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Active Tab Content */}
          <div className="bg-surface-base border border-t-0 border-border-subtle rounded-b-lg rounded-tr-lg p-6 flex flex-col gap-8 shadow-sm">

            {activeTabId === 'appearance' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Avatar Card */}
                <div className="flex flex-col gap-4">
                  <h3 className="text-[16px] font-bold text-white border-b border-border-subtle pb-2">Arte do Personagem</h3>
                  <div className="aspect-[3/4] w-full bg-surface-dim border border-border-subtle rounded-lg overflow-hidden flex items-center justify-center relative shadow-inner">
                    {avatarImg ? (
                      <img src={avatarImg} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-16 h-16 text-text-muted" />
                    )}
                  </div>

                  <div className="flex border border-border-subtle rounded bg-surface-dim overflow-hidden">
                    <button onClick={() => setAvatarInputType("upload")} className={`flex-1 py-2 text-[12px] font-medium transition-colors ${avatarInputType === 'upload' ? 'bg-surface-base text-white' : 'text-text-muted hover:text-white'}`}>Upload</button>
                    <button onClick={() => setAvatarInputType("url")} className={`flex-1 py-2 text-[12px] font-medium border-l border-border-subtle transition-colors ${avatarInputType === 'url' ? 'bg-surface-base text-white' : 'text-text-muted hover:text-white'}`}>URL</button>
                    <button onClick={() => setAvatarInputType("ai")} className={`flex-1 py-2 text-[12px] font-medium border-l border-border-subtle transition-colors flex justify-center items-center gap-1 relative overflow-hidden ${avatarInputType === 'ai' ? 'bg-surface-base text-primary' : 'text-primary/70 hover:text-primary'}`}>
                      <Sparkles className="w-3 h-3" /> IA
                    </button>
                  </div>

                  <div className="min-h-[60px]">
                    {avatarInputType === 'upload' && (
                      <div className="flex items-center justify-center border border-dashed border-border-subtle rounded p-4 text-[12px] text-text-muted cursor-pointer hover:bg-surface-dim hover:text-white transition-colors">
                        Clique para enviar arquivo
                      </div>
                    )}
                    {avatarInputType === 'url' && (
                      <div className="flex gap-2">
                        <input type="text" value={tempAvatarUrl} onChange={e => setTempAvatarUrl(e.target.value)} placeholder="https://..." className="flex-1 bg-background border border-border-subtle rounded px-3 py-2 text-[12px] text-white focus:outline-none focus:border-primary" />
                        <button onClick={() => setAvatarImg(tempAvatarUrl)} className="bg-primary hover:bg-primary/90 text-white px-3 py-2 rounded text-[12px] font-medium transition-colors">Aplicar</button>
                      </div>
                    )}
                    {avatarInputType === 'ai' && (
                      <div className="flex items-center justify-center border border-primary/30 bg-primary/5 rounded p-4 text-[12px] text-primary">
                        Gerador de Imagem por IA (Em Breve)
                      </div>
                    )}
                  </div>
                </div>

                {/* Token Card */}
                <div className="flex flex-col gap-4">
                  <h3 className="text-[16px] font-bold text-white border-b border-border-subtle pb-2">Token de Mesa</h3>
                  <div className="aspect-square w-2/3 max-w-[250px] mx-auto bg-surface-dim border-2 border-border-subtle rounded-full overflow-hidden flex items-center justify-center relative shadow-inner">
                    {tokenImg ? (
                      <img src={tokenImg} alt="Token" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-surface-base flex items-center justify-center rounded-full"><User className="w-12 h-12 text-text-muted" /></div>
                    )}
                  </div>

                  <div className="flex border border-border-subtle rounded bg-surface-dim overflow-hidden mt-auto">
                    <button onClick={() => setTokenInputType("upload")} className={`flex-1 py-2 text-[12px] font-medium transition-colors ${tokenInputType === 'upload' ? 'bg-surface-base text-white' : 'text-text-muted hover:text-white'}`}>Upload</button>
                    <button onClick={() => setTokenInputType("url")} className={`flex-1 py-2 text-[12px] font-medium border-l border-border-subtle transition-colors ${tokenInputType === 'url' ? 'bg-surface-base text-white' : 'text-text-muted hover:text-white'}`}>URL</button>
                    <button onClick={() => setTokenInputType("ai")} className={`flex-1 py-2 text-[12px] font-medium border-l border-border-subtle transition-colors flex justify-center items-center gap-1 relative overflow-hidden ${tokenInputType === 'ai' ? 'bg-surface-base text-primary' : 'text-primary/70 hover:text-primary'}`}>
                      <Sparkles className="w-3 h-3" /> IA
                    </button>
                  </div>

                  <div className="min-h-[60px]">
                    {tokenInputType === 'upload' && (
                      <div className="flex items-center justify-center border border-dashed border-border-subtle rounded p-4 text-[12px] text-text-muted cursor-pointer hover:bg-surface-dim hover:text-white transition-colors">
                        Clique para enviar arquivo
                      </div>
                    )}
                    {tokenInputType === 'url' && (
                      <div className="flex gap-2">
                        <input type="text" value={tempTokenUrl} onChange={e => setTempTokenUrl(e.target.value)} placeholder="https://..." className="flex-1 bg-background border border-border-subtle rounded px-3 py-2 text-[12px] text-white focus:outline-none focus:border-primary" />
                        <button onClick={() => setTokenImg(tempTokenUrl)} className="bg-primary hover:bg-primary/90 text-white px-3 py-2 rounded text-[12px] font-medium transition-colors">Aplicar</button>
                      </div>
                    )}
                    {tokenInputType === 'ai' && (
                      <div className="flex items-center justify-center border border-primary/30 bg-primary/5 rounded p-4 text-[12px] text-primary">
                        Gerador de Imagem por IA (Em Breve)
                      </div>
                    )}
                  </div>

                  <div className="border-t border-border-subtle pt-4 mt-2">
                    <button className="w-full bg-surface-dim hover:bg-surface-base border border-border-subtle text-text-muted hover:text-white px-4 py-3 rounded text-[13px] font-medium transition-colors flex items-center justify-center gap-2">
                      Gerar Token a partir do Avatar (Em Breve)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {template.tabs.map((tab, tIdx) => {
              if (tab.id !== activeTabId) return null;
              return (
                <div key={tab.id} className="flex flex-col gap-4">
                  <h3 className="text-[16px] font-bold text-white border-b border-border-subtle pb-2 flex justify-between items-center">
                    {isEditing ? (
                      <input type="text" value={tab.name} onChange={e => {
                        const newTabs = [...template.tabs];
                        newTabs[tIdx].name = e.target.value;
                        saveTemplate({ ...template, tabs: newTabs });
                      }} className="bg-transparent focus:outline-none border-b border-dashed border-border-subtle flex-1" />
                    ) : tab.name}

                    {isEditing && template.tabs.length > 1 && (
                      <button onClick={() => handleDeleteTab(tIdx)} className="p-1 text-text-muted hover:text-danger rounded hover:bg-danger/10 transition-colors ml-2" title="Excluir Aba">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start auto-rows-auto">
                    {tab.groups.map((group, gIdx) => {
                      const w = group.width || 1;
                      const colSpanClass = w === 3 ? "col-span-1 md:col-span-2 lg:col-span-3" : w === 2 ? "col-span-1 md:col-span-2" : "col-span-1";
                      const fieldsGridClass = w === 1 ? "grid-cols-1" : w === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4";
                      const isDraggingThis = dragSource?.tab === tIdx && dragSource?.group === gIdx;
                      const isDragOver = dragTarget?.tab === tIdx && dragTarget?.group === gIdx;

                      return (
                        <div
                          key={group.id}
                          draggable={isEditing}
                          onDragStart={(e) => handleDragStart(e, tIdx, gIdx)}
                          onDragOver={(e) => handleDragOver(e, tIdx, gIdx)}
                          onDrop={(e) => handleDrop(e, tIdx, gIdx)}
                          onDragEnd={() => { setDragSource(null); setDragTarget(null); }}
                          className={`border border-border-subtle bg-surface-dim rounded p-4 relative group transition-all duration-200 ${colSpanClass} ${isDraggingThis ? "opacity-50 scale-[0.98]" : ""} ${isDragOver && !isDraggingThis ? "border-primary border-dashed bg-primary/10 scale-[1.02]" : ""}`}
                        >
                          {isEditing && (
                            <div className="absolute top-2 right-2 flex items-center">
                              <div className="flex bg-surface-base border border-border-subtle rounded overflow-hidden mr-2">
                                <button onClick={() => {
                                  const newTabs = [...template.tabs];
                                  newTabs[tIdx].groups[gIdx].width = 1;
                                  saveTemplate({ ...template, tabs: newTabs });
                                }} className={`px-2 py-0.5 text-[10px] ${group.width === 1 || !group.width ? "bg-primary text-white font-bold" : "text-text-muted hover:bg-surface-bright"}`} title="1 Coluna">1C</button>
                                <button onClick={() => {
                                  const newTabs = [...template.tabs];
                                  newTabs[tIdx].groups[gIdx].width = 2;
                                  saveTemplate({ ...template, tabs: newTabs });
                                }} className={`px-2 py-0.5 text-[10px] ${group.width === 2 ? "bg-primary text-white font-bold" : "text-text-muted hover:bg-surface-bright"}`} title="2 Colunas">2C</button>
                                <button onClick={() => {
                                  const newTabs = [...template.tabs];
                                  newTabs[tIdx].groups[gIdx].width = 3;
                                  saveTemplate({ ...template, tabs: newTabs });
                                }} className={`px-2 py-0.5 text-[10px] ${group.width === 3 ? "bg-primary text-white font-bold" : "text-text-muted hover:bg-surface-bright"}`} title="3 Colunas">3C</button>
                              </div>
                              <div className="p-1 text-text-muted hover:text-white cursor-grab active:cursor-grabbing mr-1" title="Arraste para reordenar">
                                <GripVertical className="w-4 h-4" />
                              </div>
                              <button onClick={() => handleDeleteGroup(tIdx, gIdx)} className="p-1 text-text-muted hover:text-danger rounded hover:bg-danger/10" title="Remover Grupo">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                          {group.title || isEditing ? (
                            <div className="mb-4">
                              {isEditing ? (
                                <input type="text" placeholder="Título do Grupo" value={group.title || ""} onChange={e => {
                                  const newTabs = [...template.tabs];
                                  newTabs[tIdx].groups[gIdx].title = e.target.value;
                                  saveTemplate({ ...template, tabs: newTabs });
                                }} className="bg-transparent focus:outline-none font-bold text-[13px] uppercase tracking-wider text-white border-b border-dashed border-border-subtle w-1/2" />
                              ) : (
                                <h4 className="text-[13px] font-bold text-white uppercase tracking-wider border-b border-primary/30 pb-1 inline-block">{group.title}</h4>
                              )}
                            </div>
                          ) : null}

                          <div className={`grid gap-4 ${fieldsGridClass}`}>
                            {group.fields.map((field, fIdx) => (
                              <div key={field.id} className="flex flex-col gap-1 relative group/field">
                                <label className="text-[11px] font-medium text-text-muted flex justify-between">
                                  {field.label}
                                  {isEditing && <span className="text-secondary/50 font-mono text-[9px]">({field.id})</span>}
                                </label>

                                {isEditing ? (
                                  <div className="flex flex-col gap-2 p-2 border border-border-subtle rounded bg-surface-base min-w-0 overflow-hidden">
                                    <input
                                      type="text"
                                      value={field.label}
                                      onChange={e => handleUpdateField(tIdx, gIdx, fIdx, { ...field, label: e.target.value })}
                                      className="bg-background border border-border-subtle rounded px-2 py-1 text-[12px] text-white w-full min-w-0"
                                      placeholder="Nome do campo"
                                    />
                                    <div className="flex gap-2 w-full">
                                      <select
                                        value={field.type}
                                        onChange={e => handleUpdateField(tIdx, gIdx, fIdx, { ...field, type: e.target.value as any })}
                                        className="bg-background border border-border-subtle rounded px-2 py-1 text-[12px] text-white flex-1 min-w-0"
                                      >
                                        <option value="text">Texto</option>
                                        <option value="int">Inteiro</option>
                                        <option value="float">Decimal</option>
                                        <option value="calculated">Calculado</option>
                                        <option value="checkbox">Caixa de Seleção</option>
                                      </select>
                                      <input
                                        type="text"
                                        value={field.id}
                                        readOnly={field.readonlyId}
                                        onChange={e => handleUpdateField(tIdx, gIdx, fIdx, { ...field, id: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })}
                                        className={`border border-border-subtle rounded px-2 py-1 text-[12px] text-white w-16 shrink-0 ${field.readonlyId ? 'bg-surface-dim opacity-70 cursor-not-allowed' : 'bg-background'}`}
                                        placeholder="ID"
                                        title={field.readonlyId ? "ID bloqueado por importação" : "ID do campo"}
                                      />
                                    </div>
                                    {field.type === "calculated" && (
                                      <div className="flex items-center gap-1 w-full">
                                        <input
                                          type="text"
                                          value={field.formula || ""}
                                          onChange={e => handleUpdateField(tIdx, gIdx, fIdx, { ...field, formula: e.target.value })}
                                          className="bg-indigo-950/50 border border-indigo-500/50 rounded px-2 py-1 text-[12px] text-indigo-200 font-mono flex-1 min-w-0"
                                          placeholder="Fórmula ex: floor((str-10)/2)"
                                        />
                                        <button type="button" onClick={() => setIsHelpOpen(true)} className="p-1.5 rounded bg-surface-dim hover:bg-surface-bright text-text-muted hover:text-secondary transition-colors" title="Como usar fórmulas?">
                                          <HelpCircle className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    )}
                                    <button onClick={() => handleDeleteField(tIdx, gIdx, fIdx)} className="text-[10px] text-danger mt-1 text-left hover:underline">Remover Campo</button>
                                  </div>
                                ) : (
                                  <FieldValuePreview field={field} formValues={formValues} onChange={(val) => setFormValues(prev => ({ ...prev, [field.id]: val }))} />
                                )}
                              </div>
                            ))}

                            {isEditing && (
                              <button onClick={() => handleAddField(tIdx, gIdx)} className="border border-dashed border-border-subtle rounded flex items-center justify-center p-3 text-text-muted hover:text-white hover:bg-surface-base transition-colors h-full min-h-[60px] col-span-full">
                                <Plus className="w-4 h-4" /> Adicionar Campo
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {isEditing && (
                    <button onClick={() => handleAddGroup(tIdx)} className="border-2 border-dashed border-border-subtle rounded-lg flex items-center justify-center py-4 text-text-muted hover:text-white hover:bg-surface-dim transition-colors w-full mt-2 gap-2">
                      <PlusCircle className="w-5 h-5" /> Adicionar Grupo
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {isHelpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-surface-base border border-border-subtle rounded-lg shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border-subtle bg-surface-dim">
              <h3 className="text-[14px] font-bold text-white flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-secondary" />
                Como usar Fórmulas
              </h3>
              <button onClick={() => setIsHelpOpen(false)} className="text-text-muted hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 text-[13px] text-text-muted flex flex-col gap-4 overflow-y-auto max-h-[70vh]">
              <p>
                Os campos do tipo <strong>Calculado</strong> avaliam expressões matemáticas simples em tempo real, baseadas nos valores de outros campos.
              </p>

              <div className="bg-surface-dim p-3 rounded border border-border-subtle">
                <h4 className="font-bold text-white mb-2">Referenciando Campos</h4>
                <p>
                  Para usar o valor de outro campo, basta escrever o <strong>ID do campo</strong> na fórmula. Por exemplo, se você tem um campo "Força" com ID <code>str</code>, escreva <code>str</code>.
                </p>
              </div>

              <div className="bg-surface-dim p-3 rounded border border-border-subtle">
                <h4 className="font-bold text-white mb-2">Funções e Operadores</h4>
                <ul className="list-disc pl-4 space-y-1">
                  <li><strong>Operadores:</strong> <code>+</code>, <code>-</code>, <code>*</code>, <code>/</code></li>
                  <li><strong>Arredondamentos:</strong> <code>floor()</code> (para baixo), <code>ceil()</code> (para cima), <code>round()</code> (mais próximo)</li>
                  <li><strong>Outros:</strong> <code>abs()</code>, <code>max(a, b)</code>, <code>min(a, b)</code></li>
                </ul>
              </div>

              <div className="bg-surface-dim p-3 rounded border border-border-subtle">
                <h4 className="font-bold text-white mb-2">Exemplos</h4>
                <ul className="space-y-2">
                  <li>Modificador de atributo: <code className="text-indigo-300">floor((str - 10) / 2)</code></li>
                  <li>Iniciativa total: <code className="text-indigo-300">dex_mod + prof_bonus</code></li>
                  <li>Dano com arma: <code className="text-indigo-300">floor(str / 2) + 1</code></li>
                </ul>
              </div>
            </div>
            <div className="p-4 border-t border-border-subtle bg-surface-dim flex justify-end">
              <button onClick={() => setIsHelpOpen(false)} className="bg-secondary hover:bg-secondary/90 text-background px-4 py-2 rounded text-[13px] font-medium transition-colors">
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}

      {isExportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-surface-base border border-border-subtle rounded-lg shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[80vh]">
            <div className="flex items-center justify-between p-4 border-b border-border-subtle bg-surface-dim">
              <h3 className="text-[14px] font-bold text-white flex items-center gap-2">
                <Download className="w-4 h-4 text-primary" />
                Exportar Modelo de Ficha
              </h3>
              <button onClick={() => setIsExportOpen(false)} className="text-text-muted hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-0 overflow-y-auto bg-[#0d1117]">
              <pre className="text-[12px] text-[#c9d1d9] p-4 font-mono w-full">
                {JSON.stringify(template, null, 2)}
              </pre>
            </div>
            <div className="p-4 border-t border-border-subtle bg-surface-dim flex justify-between items-center">
              <span className="text-[12px] text-text-muted">Você pode compartilhar este JSON para que outros jogadores importem o modelo.</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsExportOpen(false)}
                  className="bg-transparent border border-border-subtle hover:bg-surface-base text-white px-4 py-2 rounded text-[13px] font-medium transition-colors"
                >
                  Fechar
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(template, null, 2));
                    setIsCopied(true);
                    setTimeout(() => setIsCopied(false), 2000);
                  }}
                  className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded text-[13px] font-medium transition-colors flex items-center gap-2"
                >
                  {isCopied ? <><Check className="w-4 h-4" /> Copiado!</> : <><Copy className="w-4 h-4" /> Copiar JSON</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function FieldValuePreview({ field, formValues, onChange }: { field: SheetField, formValues: Record<string, any>, onChange: (val: any) => void }) {
  if (field.type === "calculated") {
    // Treat all other string values that look like numbers as numbers for context
    const context: Record<string, number> = {};
    for (const [k, v] of Object.entries(formValues)) {
      if (typeof v === 'number') context[k] = v;
      else if (typeof v === 'boolean') context[k] = v ? 1 : 0;
      else if (!isNaN(Number(v))) context[k] = Number(v);
    }
    const val = evaluateFormula(field.formula || "", context);
    return (
      <div className="bg-surface-base border border-border-subtle rounded px-3 py-1.5 text-white font-mono flex items-center h-[34px] w-full overflow-hidden text-ellipsis whitespace-nowrap">
        {val}
      </div>
    );
  }

  if (field.type === "checkbox") {
    return (
      <div className="flex items-center h-[34px] px-2 w-full">
        <input
          type="checkbox"
          checked={!!formValues[field.id]}
          onChange={e => onChange(e.target.checked)}
          className="w-5 h-5 accent-primary bg-surface-dim border-border-subtle rounded cursor-pointer"
        />
      </div>
    );
  }

  if (field.type === "int" || field.type === "float") {
    return (
      <input
        type="number"
        value={formValues[field.id] || ""}
        onChange={e => onChange(field.type === 'int' ? parseInt(e.target.value) || 0 : parseFloat(e.target.value) || 0)}
        className="bg-background border border-border-subtle rounded px-3 py-1.5 focus:outline-none focus:border-primary text-white transition-colors w-full min-w-0"
      />
    );
  }

  return (
    <input
      type="text"
      value={formValues[field.id] || ""}
      onChange={e => onChange(e.target.value)}
      className="bg-background border border-border-subtle rounded px-3 py-1.5 focus:outline-none focus:border-primary text-white transition-colors w-full min-w-0"
    />
  );
}
