import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { IsIanaTimeZone } from '../validators/is-iana-timezone';

export class CreateTodoDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  completed?: boolean;

  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @IsIn(['low', 'medium', 'high'])
  @IsOptional()
  priority?: 'low' | 'medium' | 'high';

  @IsIanaTimeZone()
  @IsOptional()
  timezone?: string;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  dependsOn?: string[];
}
