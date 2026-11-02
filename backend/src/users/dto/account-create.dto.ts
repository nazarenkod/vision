import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

// An account an admin creates in Users (035): nobody signs themselves up.
export class CreateAccountDto {
  @ApiProperty()
  @IsEmail()
  readonly email: string;

  @ApiProperty({ writeOnly: true })
  @IsString()
  @IsNotEmpty()
  readonly password: string;

  @ApiProperty({ enum: Role })
  @IsEnum(Role)
  readonly role: Role;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  readonly firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  readonly lastName?: string;
}
