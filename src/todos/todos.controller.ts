import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreateTodoDto } from './dto/create-todo.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';
import { FindTodosQueryDto } from './dto/find-todos-query.dto';
import { TodosService, TodoResponse } from './todos.service';

@Controller('todos')
export class TodosController {
  constructor(private readonly todosService: TodosService) {}

  @Post()
  create(@Body() createTodoDto: CreateTodoDto): TodoResponse {
    return this.todosService.create(createTodoDto);
  }

  @Get()
  findAll(@Query() query: FindTodosQueryDto): TodoResponse[] {
    return this.todosService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string): TodoResponse {
    return this.todosService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateTodoDto: UpdateTodoDto,
  ): TodoResponse {
    return this.todosService.update(id, updateTodoDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): void {
    this.todosService.remove(id);
  }
}
