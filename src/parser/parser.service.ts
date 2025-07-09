import { Injectable } from '@nestjs/common';
import * as mammoth from 'mammoth';

@Injectable()
export class ParserService {
  async extractText(filePath: string): Promise<string> {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value.trim();
  }
}
