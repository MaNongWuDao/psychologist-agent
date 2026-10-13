import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigModule } from './config/app-config.module';
import { CounselorModule } from './counselor/counselor.module';
import { PostgresModule } from './database/postgres.module';

@Module({
  imports: [AppConfigModule, PostgresModule, CounselorModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
