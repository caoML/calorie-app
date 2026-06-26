import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { FoodModule } from './modules/food/food.module';
import { RecordModule } from './modules/record/record.module';
import { QuickFoodModule } from './modules/quick-food/quick-food.module';
import { MealTemplateModule } from './modules/meal-template/meal-template.module';
import { UserFoodModule } from './modules/user-food/user-food.module';
import { AiEstimateModule } from './modules/ai-estimate/ai-estimate.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: 'calorie.db',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: true, // 开发环境自动同步表结构，生产环境关闭
    }),
    AuthModule,
    UserModule,
    FoodModule,
    RecordModule,
    QuickFoodModule,
    MealTemplateModule,
    UserFoodModule,
    AiEstimateModule,
  ],
})
export class AppModule {}
