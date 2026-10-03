import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCampaignDto } from "./dto/create-campaign.dto";
import { UpdateCampaignDto } from "./dto/update-campaign.dto";

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateCampaignDto) {
    const campaign = await this.prisma.campaign.create({
      data: {
        name: dto.name,
        description: dto.description,
        gameSystem: dto.gameSystem ?? "generic",
        isPublic: dto.isPublic ?? false,
        maxPlayers: dto.maxPlayers ?? 6,
        ownerId: userId,
      },
      include: {
        owner: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        _count: { select: { members: true } },
      },
    });

    // Automatically add the creator as GAME_MASTER
    await this.prisma.campaignMember.create({
      data: {
        userId,
        campaignId: campaign.id,
        role: "GAME_MASTER",
      },
    });

    return campaign;
  }

  async findAll(filters?: { isPublic?: boolean; status?: string }) {
    return this.prisma.campaign.findMany({
      where: {
        ...(filters?.isPublic !== undefined && { isPublic: filters.isPublic }),
        ...(filters?.status && { status: filters.status as any }),
      },
      include: {
        owner: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        _count: { select: { members: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  async findUserCampaigns(userId: string) {
    return this.prisma.campaign.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } },
        ],
      },
      include: {
        owner: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        _count: { select: { members: true } },
        members: {
          where: { userId },
          select: { role: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  async findOne(id: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: {
        owner: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, username: true, displayName: true, avatarUrl: true },
            },
          },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException("Campaign not found");
    }

    return campaign;
  }

  async update(id: string, userId: string, dto: UpdateCampaignDto) {
    await this.ensureOwnership(id, userId);

    return this.prisma.campaign.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.gameSystem && { gameSystem: dto.gameSystem }),
        ...(dto.isPublic !== undefined && { isPublic: dto.isPublic }),
        ...(dto.maxPlayers && { maxPlayers: dto.maxPlayers }),
        ...(dto.status && { status: dto.status }),
        ...(dto.coverImageUrl !== undefined && { coverImageUrl: dto.coverImageUrl }),
      },
      include: {
        owner: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        _count: { select: { members: true } },
      },
    });
  }

  async remove(id: string, userId: string) {
    await this.ensureOwnership(id, userId);

    await this.prisma.campaign.delete({ where: { id } });

    return { message: "Campaign deleted successfully" };
  }

  async joinCampaign(campaignId: string, userId: string) {
    const campaign = await this.findOne(campaignId);

    // Check if already a member
    const existingMember = await this.prisma.campaignMember.findUnique({
      where: { userId_campaignId: { userId, campaignId } },
    });

    if (existingMember) {
      throw new ForbiddenException("You are already a member of this campaign");
    }

    // Check max players
    const memberCount = await this.prisma.campaignMember.count({
      where: { campaignId },
    });

    if (memberCount >= campaign.maxPlayers) {
      throw new ForbiddenException("Campaign is full");
    }

    return this.prisma.campaignMember.create({
      data: {
        userId,
        campaignId,
        role: "PLAYER",
      },
      include: {
        user: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
      },
    });
  }

  async leaveCampaign(campaignId: string, userId: string) {
    const campaign = await this.findOne(campaignId);

    if (campaign.ownerId === userId) {
      throw new ForbiddenException(
        "Campaign owner cannot leave. Transfer ownership or delete the campaign.",
      );
    }

    await this.prisma.campaignMember.delete({
      where: { userId_campaignId: { userId, campaignId } },
    });

    return { message: "Left campaign successfully" };
  }

  private async ensureOwnership(campaignId: string, userId: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { ownerId: true },
    });

    if (!campaign) {
      throw new NotFoundException("Campaign not found");
    }

    if (campaign.ownerId !== userId) {
      throw new ForbiddenException("You are not the owner of this campaign");
    }
  }
}
