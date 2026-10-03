import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CampaignsService } from "./campaigns.service";
import { CreateCampaignDto } from "./dto/create-campaign.dto";
import { UpdateCampaignDto } from "./dto/update-campaign.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Public } from "../common/decorators/public.decorator";

@Controller("campaigns")
@UseGuards(JwtAuthGuard)
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Post()
  create(
    @CurrentUser("id") userId: string,
    @Body() dto: CreateCampaignDto,
  ) {
    return this.campaignsService.create(userId, dto);
  }

  /** Browse public campaigns — no auth required */
  @Get("browse")
  @Public()
  browse(@Query("status") status?: string) {
    return this.campaignsService.findAll({ isPublic: true, status });
  }

  /** Get campaigns the current user is a member of */
  @Get("my")
  findMyCampaigns(@CurrentUser("id") userId: string) {
    return this.campaignsService.findUserCampaigns(userId);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.campaignsService.findOne(id);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @CurrentUser("id") userId: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    return this.campaignsService.update(id, userId, dto);
  }

  @Delete(":id")
  remove(
    @Param("id") id: string,
    @CurrentUser("id") userId: string,
  ) {
    return this.campaignsService.remove(id, userId);
  }

  @Post(":id/join")
  join(
    @Param("id") campaignId: string,
    @CurrentUser("id") userId: string,
  ) {
    return this.campaignsService.joinCampaign(campaignId, userId);
  }

  @Post(":id/leave")
  leave(
    @Param("id") campaignId: string,
    @CurrentUser("id") userId: string,
  ) {
    return this.campaignsService.leaveCampaign(campaignId, userId);
  }
}
