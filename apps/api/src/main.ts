import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global validation pipe for DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS for Next.js frontend
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
    credentials: true,
  });

  app.setGlobalPrefix("api");

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`🚀 QuestDreamer API running on http://localhost:${port}`);
}

bootstrap();
