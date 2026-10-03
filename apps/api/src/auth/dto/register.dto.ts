import { IsEmail, IsString, MinLength, MaxLength, Matches } from "class-validator";

export class RegisterDto {
  @IsEmail({}, { message: "Please provide a valid email address" })
  email!: string;

  @IsString()
  @MinLength(3, { message: "Username must be at least 3 characters" })
  @MaxLength(30, { message: "Username must be at most 30 characters" })
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: "Username can only contain letters, numbers, underscores and hyphens",
  })
  username!: string;

  @IsString()
  @MinLength(1, { message: "Display name is required" })
  @MaxLength(50, { message: "Display name must be at most 50 characters" })
  displayName!: string;

  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters" })
  @MaxLength(128, { message: "Password must be at most 128 characters" })
  password!: string;
}
