import { CreateUserDto } from './dto/user-create.dto';
import { UserLoginResponseDto } from './dto/user-login-response.dto';
import { User } from '@prisma/client';
import { UpdateUserDto } from './dto/user-update.dto';
import { UserLoginRequestDto } from './dto/user-login-request.dto';

export interface Users {
  create(createUserDto: CreateUserDto): Promise<UserLoginResponseDto>;
  // sessionId: the sign-in the request came with, which the new token keeps (VIS-SEC-059)
  update(id: string, userDto: UpdateUserDto, sessionId?: string): Promise<UserLoginResponseDto>;
  changePassword(user: User, newPassword: string): Promise<boolean>;
  login(userLoginRequestDto: UserLoginRequestDto): Promise<UserLoginResponseDto>;
}
