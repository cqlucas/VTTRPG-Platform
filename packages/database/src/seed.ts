import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  const HASH = "$2b$12$kyctqoNJBcIqgnEF4FYQOe8aWJbMG5D89KUiNkP6MD4GrU5c4zhW.";

  // Create a demo Game Master user
  const gm = await prisma.user.upsert({
    where: { email: "gm@questdreamer.dev" },
    update: { passwordHash: HASH },
    create: {
      email: "gm@questdreamer.dev",
      username: "dungeon_master",
      displayName: "The Dungeon Master",
      passwordHash: HASH,
      bio: "Weaver of worlds and keeper of secrets.",
    },
  });

  // Create a demo Player user
  const player = await prisma.user.upsert({
    where: { email: "player@questdreamer.dev" },
    update: { passwordHash: HASH },
    create: {
      email: "player@questdreamer.dev",
      username: "hero_one",
      displayName: "Adventurer Prime",
      passwordHash: HASH,
      bio: "Seeker of treasure and glory.",
    },
  });

  // Create a demo Campaign
  const campaign = await prisma.campaign.upsert({
    where: { id: "demo-campaign-001" },
    update: {},
    create: {
      id: "demo-campaign-001",
      name: "The Lost Mines of Phandelver",
      description:
        "A classic adventure for 4-5 characters of levels 1-5. Explore the frontier town of Phandalin and uncover the secrets of the Lost Mine of Phandelver.",
      gameSystem: "dnd5e",
      isPublic: true,
      maxPlayers: 5,
      status: "ACTIVE",
      ownerId: gm.id,
    },
  });

  // Add members to the campaign
  await prisma.campaignMember.upsert({
    where: {
      userId_campaignId: { userId: gm.id, campaignId: campaign.id },
    },
    update: {},
    create: {
      userId: gm.id,
      campaignId: campaign.id,
      role: "GAME_MASTER",
    },
  });

  await prisma.campaignMember.upsert({
    where: {
      userId_campaignId: { userId: player.id, campaignId: campaign.id },
    },
    update: {},
    create: {
      userId: player.id,
      campaignId: campaign.id,
      role: "PLAYER",
    },
  });

  console.log("✅ Seed complete!");
  console.log(`   Created users: ${gm.username}, ${player.username}`);
  console.log(`   Created campaign: ${campaign.name}`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
