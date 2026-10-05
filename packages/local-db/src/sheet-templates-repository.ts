import { newId } from "./utils";
import { type SheetTemplate, CURRENT_ENTRY_SCHEMA_VERSION, QuestDreamerLocalDB, LOCAL_DB_NAME } from "./schema";

const getDb = () => new QuestDreamerLocalDB(LOCAL_DB_NAME);

export class SheetTemplatesRepository {
  static async listTemplates(campaignId?: string): Promise<SheetTemplate[]> {
    const db = getDb();
    if (campaignId) {
      return db.sheetTemplates.where("campaignId").equals(campaignId).filter(t => !t.deleted).toArray();
    }
    return db.sheetTemplates.filter(t => !t.deleted).toArray();
  }

  static async getTemplate(id: string): Promise<SheetTemplate | undefined> {
    const db = getDb();
    const template = await db.sheetTemplates.get(id);
    if (template && !template.deleted) return template;
    return undefined;
  }

  static async createTemplate(templateData: Omit<SheetTemplate, "id" | "revision" | "createdAt" | "updatedAt" | "deleted" | "schemaVersion">): Promise<SheetTemplate> {
    const db = getDb();
    const now = Date.now();
    const newTemplate: SheetTemplate = {
      ...templateData,
      id: newId(),
      revision: 1,
      createdAt: now,
      updatedAt: now,
      deleted: false,
      schemaVersion: CURRENT_ENTRY_SCHEMA_VERSION,
    };
    await db.sheetTemplates.add(newTemplate);
    return newTemplate;
  }

  static async updateTemplate(id: string, updates: Partial<Omit<SheetTemplate, "id" | "revision" | "createdAt" | "deleted" | "schemaVersion">>): Promise<SheetTemplate> {
    const db = getDb();
    return db.transaction("rw", db.sheetTemplates, async () => {
      const template = await db.sheetTemplates.get(id);
      if (!template || template.deleted) throw new Error(`Template not found: ${id}`);
      
      const updatedTemplate: SheetTemplate = {
        ...template,
        ...updates,
        revision: template.revision + 1,
        updatedAt: Date.now(),
      };
      
      await db.sheetTemplates.put(updatedTemplate);
      return updatedTemplate;
    });
  }

  static async deleteTemplate(id: string): Promise<void> {
    const db = getDb();
    return db.transaction("rw", db.sheetTemplates, async () => {
      const template = await db.sheetTemplates.get(id);
      if (!template || template.deleted) return;
      
      await db.sheetTemplates.put({
        ...template,
        deleted: true,
        deletedAt: Date.now(),
        revision: template.revision + 1,
        updatedAt: Date.now(),
      });
    });
  }
}
