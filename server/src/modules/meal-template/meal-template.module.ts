import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MealTemplate } from './meal-template.entity';
import { MealTemplateService } from './meal-template.service';
import { MealTemplateController } from './meal-template.controller';

@Module({
  imports: [TypeOrmModule.forFeature([MealTemplate])],
  controllers: [MealTemplateController],
  providers: [MealTemplateService],
  exports: [MealTemplateService],
})
export class MealTemplateModule {}
