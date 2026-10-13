import { Global, Module } from '@nestjs/common';
import { APP_ENV, loadAppEnv } from './app-env';

@Global()
@Module({
  providers: [
    {
      provide: APP_ENV,
      useFactory: loadAppEnv,
    },
  ],
  exports: [APP_ENV],
})
export class AppConfigModule {}
