import { injectable, inject } from 'inversify';
import { TYPES } from '../types/types';
import { PrismaClient, User } from '@prisma/client';
import bcrypt from 'bcryptjs';

export interface IAuthRepository {
  findByUsernameOrEmail(usernameOrEmail: string): Promise<User | null>;
  validatePassword(user: User, password: string): Promise<boolean>;
}

@injectable()
export class AuthRepository implements IAuthRepository {
  constructor(
    @inject(TYPES.PrismaClient)
    private prisma: PrismaClient
  ) {}

  /**
   * @param usernameOrEmail Username or email from login input
   * @returns User record if found, otherwise null
   */
  async findByUsernameOrEmail(usernameOrEmail: string): Promise<User | null> {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ username: usernameOrEmail }, { email: usernameOrEmail }],
        isActive: true,
      },
      include: {
        role: {
          include: {
            rolePermissions: {
              where: {
                isActive: true,
              },
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    return user;
  }

  /**
   * Validate a user's password using bcrypt
   * @param user User object from database (contains hashed password)
   * @param password Plain text password from login request
   * @returns true if password matches hashed password, otherwise false
   */
  async validatePassword(user: User, password: string): Promise<boolean> {
    try {
      const isMatch = await bcrypt.compare(password, user.password);
      return isMatch;
    } catch (error) {
      console.error('Error validating password:', error);
      return false;
    }
  }
}
