import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FoodController } from './food.controller';
import { FoodService } from './food.service';
import { Food } from './food.entity';
import { UserFoodModule } from '../user-food/user-food.module';

@Module({
  imports: [TypeOrmModule.forFeature([Food]), UserFoodModule],
  controllers: [FoodController],
  providers: [FoodService],
  exports: [FoodService],
})
export class FoodModule {}
