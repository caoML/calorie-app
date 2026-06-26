import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserFoodController } from './user-food.controller';
import { UserFoodService } from './user-food.service';
import { UserFood } from './user-food.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserFood])],
  controllers: [UserFoodController],
  providers: [UserFoodService],
  exports: [UserFoodService],
})
export class UserFoodModule {}
