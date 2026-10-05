import { QuestDreamerLocalDB } from "@questdreamer/local-db/src/schema";
import { LoreRepository } from "@questdreamer/local-db/src/lore-repository";

// Singletons for the web app
export const localDb = new QuestDreamerLocalDB();
export const loreRepo = new LoreRepository(localDb);
