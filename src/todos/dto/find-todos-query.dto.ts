import {
  IsBooleanString,
  IsDateString,
  IsIn,
  IsOptional,
  Matches,
} from 'class-validator';

export class FindTodosQueryDto {
  @IsIn(['dueDate'])
  @IsOptional()
  sortBy?: 'dueDate';

  @IsIn(['asc', 'desc'])
  @IsOptional()
  order?: 'asc' | 'desc';

  @IsBooleanString()
  @IsOptional()
  overdue?: string;

  @IsDateString()
  @IsOptional()
  dueBefore?: string;

  @IsDateString()
  @IsOptional()
  dueAfter?: string;

  @Matches(/^(low|medium|high)(,(low|medium|high))*$/)
  @IsOptional()
  priority?: string;
}
