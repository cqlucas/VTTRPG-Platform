import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsEnum,
  Min,
  Max,
  MaxLength,
} from "class-validator";

enum CampaignStatus {
  DRAFT = "DRAFT",
  ACTIVE = "ACTIVE",
  PAUSED = "PAUSED",
  ARCHIVED = "ARCHIVED",
}

export class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  gameSystem?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(20)
  maxPlayers?: number;

  @IsOptional()
  @IsEnum(CampaignStatus)
  status?: CampaignStatus;

  @IsOptional()
  @IsString()
  coverImageUrl?: string;
}
