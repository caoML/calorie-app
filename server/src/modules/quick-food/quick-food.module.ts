import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuickFood } from './quick-food.entity';
import { QuickFoodService } from './quick-food.service';
import { QuickFoodController } from './quick-food.controller';

@Module({
  imports: [TypeOrmModule.forFeature([QuickFood])],
  controllers: [QuickFoodController],
  providers: [QuickFoodService],
  exports: [QuickFoodService],
})
export class QuickFoodModule {}
