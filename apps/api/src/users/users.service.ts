import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async updateProfile(userId: string, dto: any) {
    // 1. Verify current password if they try to change the password
    if (dto.newPassword) {
      if (!dto.currentPassword) {
        throw new UnauthorizedException("Senha atual é necessária para definir uma nova senha.");
      }
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new UnauthorizedException("Usuário não encontrado.");
      
      const isPasswordValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
      if (!isPasswordValid) {
        throw new UnauthorizedException("Senha atual incorreta.");
      }
    }

    // 2. Check for email/username conflicts if they are changing them
    const orConditions = [];
    if (dto.email) orConditions.push({ email: dto.email });
    if (dto.username) orConditions.push({ username: dto.username });

    if (orConditions.length > 0) {
      const conflictCheck = await this.prisma.user.findFirst({
        where: {
          id: { not: userId },
          OR: orConditions
        }
      });

      if (conflictCheck) {
        if (dto.email && conflictCheck.email === dto.email) {
          throw new ConflictException("Email já está em uso.");
        }
        throw new ConflictException("Nome de usuário já está em uso.");
      }
    }

    // 3. Update data
    const dataToUpdate: any = {};
    if (dto.displayName !== undefined) dataToUpdate.displayName = dto.displayName;
    if (dto.username !== undefined) dataToUpdate.username = dto.username;
    if (dto.email !== undefined) dataToUpdate.email = dto.email;
    if (dto.avatarUrl !== undefined) dataToUpdate.avatarUrl = dto.avatarUrl || null;

    if (dto.newPassword) {
      dataToUpdate.passwordHash = await bcrypt.hash(dto.newPassword, 12);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: dataToUpdate,
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarUrl: true,
      }
    });

    return { user: updatedUser };
  }
}
