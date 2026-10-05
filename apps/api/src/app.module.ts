import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { CampaignsModule } from "./campaigns/campaigns.module";
import { SignalingModule } from "./signaling/signaling.module";
import { UsersModule } from "./users/users.module";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    CampaignsModule,
    SignalingModule,
    UsersModule,
  ],
  providers: [
    // Apply JWT guard globally — use @Public() to exempt specific routes
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
