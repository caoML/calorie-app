import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExerciseController } from './exercise.controller';
import { ExerciseService } from './exercise.service';
import { ExerciseRecord } from './exercise.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ExerciseRecord])],
  controllers: [ExerciseController],
  providers: [ExerciseService],
})
export class ExerciseModule {}
