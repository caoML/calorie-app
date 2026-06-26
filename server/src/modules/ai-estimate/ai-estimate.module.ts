import { Module } from '@nestjs/common';
import { AiEstimateController } from './ai-estimate.controller';
import { AiEstimateService } from './ai-estimate.service';
import { UserFoodModule } from '../user-food/user-food.module';

@Module({
  imports: [UserFoodModule],
  controllers: [AiEstimateController],
  providers: [AiEstimateService],
})
export class AiEstimateModule {}
