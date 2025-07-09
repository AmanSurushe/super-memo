import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { CliService } from './cli/cli.service';
import 'dotenv/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const cli = app.get(CliService);
  await cli.run();
  await app.close();
  // await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
