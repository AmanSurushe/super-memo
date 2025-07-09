import { Module } from '@nestjs/common';
// import { AppController } from './app.controller';
// import { AppService } from './app.service';
import { CliService } from './cli/cli.service';
import { ParserService } from './parser/parser.service';
import { AIService } from './ai/ai.service';
import { CardsService } from './cards/cards.service';

@Module({
  // imports: [],
  // controllers: [AppController],
  providers: [CliService, ParserService, AIService, CardsService],
})
export class AppModule {}
