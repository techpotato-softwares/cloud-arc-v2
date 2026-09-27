import { injectable, inject } from "inversify";
import { TYPES } from "../types/svc.types";
import {
  UserListResponse,
  UserResponse,
} from "../schemas/response/UserResponse";
import {
  CreateUserRequest,
  UpdateUserRequest,
  ListUserRequest,
} from "../schemas/request/UserRequest";
import { IUserRepository } from "../repositories/UserRepository";
import { User } from "@forgearc/shared";
import bcrypt from "bcryptjs";

export interface IUserService {
  getAllUsers(params?: ListUserRequest): Promise<UserListResponse>;
  createUser(data: CreateUserRequest): Promise<UserResponse>;
  getUserById(id: number): Promise<UserResponse | null>;
  updateUser(id: number, data: UpdateUserRequest): Promise<UserResponse>;
  deleteUser(id: number): Promise<{ id: number; deleted: boolean }>;
}

@injectable()
export class UserService implements IUserService {
  constructor(
    @inject(TYPES.UserRepository)
    private userRepository: IUserRepository,
  ) {}
  // hash pwd using bcryptjs
  private async hashPassword(password: string): Promise<string> {
    const hashStrength = 10;
    return await bcrypt.hash(password, hashStrength);
  }

  async createUser(data: CreateUserRequest): Promise<UserResponse> {
    const plainPassword = data.password;
    const encryptedPassword = await this.hashPassword(plainPassword);
    const userData: CreateUserRequest = {
      username: data.username,
      email: data.email,
      password: encryptedPassword, // ONLY THIS FIELD IS ENCRYPTED
      role: data.role,
      roleId: data.roleId,
      isActive: data.isActive,
      createdById: data.createdById,
      updatedById: data.updatedById,
    };

    const user: User = await this.userRepository.create(userData);

    // Extract role name from direct role relation (1-to-1)
    const userWithRole = user as unknown as {
      role?: { roleName: string };
      roleId?: number | null;
    };
    const roleName = userWithRole.role?.roleName || "";

    return {
      userId: user.userId,
      username: user.username,
      email: user.email,
      role: roleName,
      roleId: userWithRole.roleId || undefined,
      isActive: user.isActive,
    };
  }

  async getUserById(id: number): Promise<UserResponse | null> {
    const user: User | null = await this.userRepository.findById(id);

    if (!user) return null;

    // Extract role name from direct role relation (1-to-1)
    const userWithRole = user as unknown as {
      role?: { roleName: string };
      roleId?: number | null;
    };
    const roleName = userWithRole.role?.roleName || "";

    return {
      userId: user.userId,
      username: user.username,
      email: user.email,
      role: roleName,
      roleId: userWithRole.roleId || undefined,
      isActive: user.isActive,
    };
  }

  async getAllUsers(params?: ListUserRequest): Promise<UserListResponse> {
    const { rows, count } = await this.userRepository.findAll(params);
    const page = params?.page || 1;
    const limit = params?.limit || 20;
    const totalPages = Math.ceil(count / limit);

    const modifiedUsers = rows.map((user: User) => {
      const userWithRole = user as unknown as {
        role?: { roleName: string };
        roleId?: number | null;
      };
      const roleName = userWithRole.role?.roleName || "";
      return {
        userId: user.userId,
        username: user.username,
        email: user.email,
        role: roleName,
        roleId: userWithRole.roleId || undefined,
        isActive: user.isActive,
        createdAt: user.createdAt.toISOString(),
      };
    });

    return {
      data: modifiedUsers,
      pagination: {
        page,
        limit,
        total: count,
        totalPages,
      },
    };
  }

  async updateUser(id: number, data: UpdateUserRequest): Promise<UserResponse> {
    // If password is provided, encrypt ONLY the password
    if (data.password) {
      data.password = await this.hashPassword(data.password); //  ONLY password encrypted
    }
    const user: User = await this.userRepository.update(id, data);

    // Extract role name from direct role relation (1-to-1)
    const userWithRole = user as unknown as {
      role?: { roleName: string };
      roleId?: number | null;
    };
    const roleName = userWithRole.role?.roleName || "";

    return {
      userId: user.userId,
      username: user.username,
      email: user.email,
      role: roleName,
      roleId: userWithRole.roleId || undefined,
      isActive: user.isActive,
    };
  }

  async deleteUser(id: number): Promise<{ id: number; deleted: boolean }> {
    await this.userRepository.delete(id);
    return {
      id,
      deleted: true,
    };
  }
}
