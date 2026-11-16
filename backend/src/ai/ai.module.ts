import { Module } from '@nestjs/common';
import { StaticModule } from '../static/static.module';
import { TestRunsModule } from '../test-runs/test-runs.module';
import { A11yModule } from '../a11y/a11y.module';
import { UiTreeModule } from '../ui-tree/ui-tree.module';
import { GeminiService } from '../compare/libs/vlm/providers/gemini/gemini.service';
import { OllamaService } from '../compare/libs/vlm/providers/ollama/ollama.service';
import { AiService } from './ai.service';
import { AiFeaturesService } from './ai-features.service';
import { AiController } from './ai.controller';

@Module({
  imports: [StaticModule, TestRunsModule, A11yModule, UiTreeModule],
  providers: [AiService, AiFeaturesService, GeminiService, OllamaService],
  controllers: [AiController],
})
export class AiModule {}
