import { ApiProperty } from '@nestjs/swagger';
import { TestRunDto } from '../../test-runs/dto/testRun.dto';

export class BaselineDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  baselineName: string;

  @ApiProperty()
  testVariationId: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  testRun: TestRunDto;

  // who approved it: only what the history shows, never credentials
  @ApiProperty()
  user: BaselineUser | null;
}

export type BaselineUser = { id: string; firstName: string | null; lastName: string | null; email: string };
