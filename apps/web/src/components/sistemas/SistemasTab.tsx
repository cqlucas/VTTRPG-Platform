import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { FileText, MoreVertical, PlusCircle, Save, Trash2, Edit2, Play, Settings, Plus, HelpCircle, X } from "lucide-react";
import { SheetTemplatesRepository, type SheetTemplate, type SheetTab, type SheetGroup, type SheetField } from "@questdreamer/local-db";
import { useLiveQuery } from "../../lib/useLiveQuery";
import { evaluateFormula } from "../../lib/formula";

export function SistemasTab() {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  
  const templates = useLiveQuery(() => SheetTemplatesRepository.listTemplates(), []) || [];

  const handleCreateNew = async () => {
    const newTpl = await SheetTemplatesRepository.createTemplate({
      title: "Nova Ficha",
      description: "Descreva o modelo...",
      tabs: [{ id: "tab-1", name: "Principal", groups: [] }]
    });
    setSelectedTemplateId(newTpl.id);
  };

  if (selectedTemplateId) {
    return <SheetTemplateView templateId={selectedTemplateId} onBack={() => setSelectedTemplateId(null)} />;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6 pb-8 overflow-y-auto h-full">
      <div className="flex justify-between items-center">
        <p className="text-text-muted text-[13px]">Gerencie seus modelos de fichas e estatísticas.</p>
        <button 
          onClick={handleCreateNew}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-md font-medium text-[13px] transition-colors flex items-center gap-2"
        >
          <PlusCircle className="w-4 h-4" />
          Novo Modelo de Ficha
        </button>
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
    </motion.div>
  );
}

function SheetTemplateView({ templateId, onBack }: { templateId: string, onBack: () => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [template, setTemplate] = useState<SheetTemplate | null>(null);
  
  // Sheet mock values state for preview (View Mode)
  const [formValues, setFormValues] = useState<Record<string, number | string>>({});

  useEffect(() => {
    SheetTemplatesRepository.getTemplate(templateId).then(t => {
      if (t) setTemplate(t);
    });
  }, [templateId]);

  if (!template) return <div>Carregando...</div>;

  const saveTemplate = async (updated: SheetTemplate) => {
    setTemplate(updated);
    await SheetTemplatesRepository.updateTemplate(updated.id, {
      title: updated.title,
      description: updated.description,
      tabs: updated.tabs
    });
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

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col gap-6 h-full pb-8">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 rounded hover:bg-surface-dim text-text-muted hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <div>
            {isEditing ? (
              <input 
                type="text" 
                value={template.title} 
                onChange={e => saveTemplate({...template, title: e.target.value})}
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
                onChange={e => saveTemplate({...template, description: e.target.value})}
                className="text-[12px] text-text-muted bg-transparent border-b border-border-subtle w-full focus:outline-none focus:border-primary"
              />
            ) : (
              <p className="text-[12px] text-text-muted mt-1">{template.description}</p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsEditing(!isEditing)}
            className={`${isEditing ? 'bg-success hover:bg-success/90' : 'bg-primary hover:bg-primary/90'} text-primary-foreground px-4 py-2 rounded text-[12px] font-medium transition-colors flex items-center gap-2`}
          >
            {isEditing ? <><Play className="w-4 h-4" /> Finalizar Edição</> : <><Edit2 className="w-4 h-4" /> Editar Estrutura</>}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="bg-surface-base border border-border-subtle rounded-lg p-6 max-w-4xl mx-auto flex flex-col gap-8 shadow-sm">
          {template.tabs.map((tab, tIdx) => (
            <div key={tab.id} className="flex flex-col gap-4">
              <h3 className="text-[16px] font-bold text-white border-b border-border-subtle pb-2">
                {isEditing ? (
                  <input type="text" value={tab.name} onChange={e => {
                    const newTabs = [...template.tabs];
                    newTabs[tIdx].name = e.target.value;
                    saveTemplate({...template, tabs: newTabs});
                  }} className="bg-transparent focus:outline-none border-b border-dashed border-border-subtle" />
                ) : tab.name}
              </h3>

              {tab.groups.map((group, gIdx) => (
                <div key={group.id} className="border border-border-subtle bg-surface-dim rounded p-4 relative group">
                  {isEditing && (
                    <button onClick={() => handleDeleteGroup(tIdx, gIdx)} className="absolute top-2 right-2 p-1 text-text-muted hover:text-danger rounded hover:bg-danger/10">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  {group.title || isEditing ? (
                    <div className="mb-4">
                      {isEditing ? (
                        <input type="text" placeholder="Título do Grupo" value={group.title || ""} onChange={e => {
                          const newTabs = [...template.tabs];
                          newTabs[tIdx].groups[gIdx].title = e.target.value;
                          saveTemplate({...template, tabs: newTabs});
                        }} className="bg-transparent focus:outline-none font-bold text-[13px] uppercase tracking-wider text-white border-b border-dashed border-border-subtle w-1/2" />
                      ) : (
                        <h4 className="text-[13px] font-bold text-white uppercase tracking-wider border-b border-primary/30 pb-1 inline-block">{group.title}</h4>
                      )}
                    </div>
                  ) : null}

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {group.fields.map((field, fIdx) => (
                      <div key={field.id} className="flex flex-col gap-1 relative group/field">
                        <label className="text-[11px] font-medium text-text-muted flex justify-between">
                          {field.label}
                          {isEditing && <span className="text-secondary/50 font-mono text-[9px]">({field.id})</span>}
                        </label>

                        {isEditing ? (
                          <div className="flex flex-col gap-2 p-2 border border-border-subtle rounded bg-surface-base">
                            <input 
                              type="text" 
                              value={field.label} 
                              onChange={e => handleUpdateField(tIdx, gIdx, fIdx, {...field, label: e.target.value})} 
                              className="bg-background border border-border-subtle rounded px-2 py-1 text-[12px] text-white" 
                              placeholder="Nome do campo"
                            />
                            <div className="flex gap-2">
                              <select 
                                value={field.type} 
                                onChange={e => handleUpdateField(tIdx, gIdx, fIdx, {...field, type: e.target.value as any})}
                                className="bg-background border border-border-subtle rounded px-2 py-1 text-[12px] text-white flex-1"
                              >
                                <option value="text">Texto</option>
                                <option value="int">Inteiro</option>
                                <option value="float">Decimal</option>
                                <option value="calculated">Calculado</option>
                              </select>
                              <input 
                                type="text" 
                                value={field.id} 
                                onChange={e => handleUpdateField(tIdx, gIdx, fIdx, {...field, id: e.target.value.replace(/[^a-zA-Z0-9_]/g, '')})} 
                                className="bg-background border border-border-subtle rounded px-2 py-1 text-[12px] text-white w-20" 
                                placeholder="ID"
                              />
                            </div>
                            {field.type === "calculated" && (
                              <div className="flex items-center gap-1">
                                <input 
                                  type="text" 
                                  value={field.formula || ""} 
                                  onChange={e => handleUpdateField(tIdx, gIdx, fIdx, {...field, formula: e.target.value})} 
                                  className="bg-indigo-950/50 border border-indigo-500/50 rounded px-2 py-1 text-[12px] text-indigo-200 font-mono flex-1" 
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
                          <FieldValuePreview field={field} formValues={formValues} onChange={(val) => setFormValues(prev => ({...prev, [field.id]: val}))} />
                        )}
                      </div>
                    ))}
                    
                    {isEditing && (
                      <button onClick={() => handleAddField(tIdx, gIdx)} className="border border-dashed border-border-subtle rounded flex items-center justify-center p-3 text-text-muted hover:text-white hover:bg-surface-base transition-colors h-full min-h-[60px]">
                        <Plus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {isEditing && (
                <button onClick={() => handleAddGroup(tIdx)} className="border-2 border-dashed border-border-subtle rounded-lg flex items-center justify-center py-4 text-text-muted hover:text-white hover:bg-surface-dim transition-colors w-full mt-2 gap-2">
                  <PlusCircle className="w-5 h-5" /> Adicionar Grupo
                </button>
              )}
            </div>
          ))}
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
    </motion.div>
  );
}

function FieldValuePreview({ field, formValues, onChange }: { field: SheetField, formValues: Record<string, any>, onChange: (val: any) => void }) {
  if (field.type === "calculated") {
    // Treat all other string values that look like numbers as numbers for context
    const context: Record<string, number> = {};
    for (const [k, v] of Object.entries(formValues)) {
      if (typeof v === 'number') context[k] = v;
      else if (!isNaN(Number(v))) context[k] = Number(v);
    }
    const val = evaluateFormula(field.formula || "", context);
    return (
      <div className="bg-surface-base border border-border-subtle rounded px-3 py-1.5 text-white font-mono flex items-center h-[34px]">
        {val}
      </div>
    );
  }

  if (field.type === "int" || field.type === "float") {
    return (
      <input 
        type="number" 
        value={formValues[field.id] || ""} 
        onChange={e => onChange(field.type === 'int' ? parseInt(e.target.value) || 0 : parseFloat(e.target.value) || 0)}
        className="bg-background border border-border-subtle rounded px-3 py-1.5 focus:outline-none focus:border-primary text-white transition-colors"
      />
    );
  }

  return (
    <input 
      type="text" 
      value={formValues[field.id] || ""} 
      onChange={e => onChange(e.target.value)}
      className="bg-background border border-border-subtle rounded px-3 py-1.5 focus:outline-none focus:border-primary text-white transition-colors"
    />
  );
}
