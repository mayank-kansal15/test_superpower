export class Todo {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  createdAt: Date;
  dueDate?: Date;
  timezone?: string;
  priority: 'low' | 'medium' | 'high';
  dependsOn: string[];
}
