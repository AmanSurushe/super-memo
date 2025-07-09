import OpenAI from 'openai';

export class AIService {
  private openai: OpenAI;
  private maxRetries = 3;
  private retryDelay = 1000; // 1 second
  private requestTimeout = 30000; // 30 seconds timeout
  
  // List of free models to try in order of preference
  private freeModels = [
    'nousresearch/hermes-3-llama-3.1-405b:free',
    'google/gemini-2.0-flash-exp:free',
    'mistralai/mistral-7b-instruct:free'
  ];
  
  // API usage tracking
  private apiCalls = {
    total: 0,
    successful: 0,
    failed: 0,
    byModel: {} as Record<string, { calls: number, successes: number, failures: number }>
  };

  constructor() {
    // Initialize OpenAI client with OpenRouter base URL
    this.openai = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY || '', // Add this to your .env file
      dangerouslyAllowBrowser: false
    });
  }

  /**
   * Validates the input text length
   * @param text The text to validate
   * @returns True if valid, false otherwise
   */
  private validateInputText(text: string): boolean {
    // Check if text is empty
    if (!text || text.trim().length === 0) {
      return false;
    }
    
    // Check if text is too long (most models have context limits)
    // A conservative limit of 4000 characters should work for most free models
    const MAX_TEXT_LENGTH = 4000;
    if (text.length > MAX_TEXT_LENGTH) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Sanitizes the input text to prevent issues with the API
   * @param text The text to sanitize
   * @returns Sanitized text
   */
  private sanitizeInputText(text: string): string {
    // Remove any control characters that might cause issues
    let sanitized = text.replace(/[\x00-\x1F\x7F]/g, '');
    
    // Trim excessive whitespace
    sanitized = sanitized.replace(/\s+/g, ' ').trim();
    
    // Ensure the text doesn't have too many consecutive newlines
    sanitized = sanitized.replace(/\n{3,}/g, '\n\n');
    
    return sanitized;
  }
  
  /**
   * Formats the generated flashcards to ensure consistent formatting
   * @param content The raw content from the API
   * @returns Formatted flashcards
   */
  private formatFlashcards(content: string): string {
    if (!content) {
      return 'No flashcards were generated. Please try again with different text.';
    }
    
    // Ensure each flashcard starts with Q: and has an A:
    let formatted = content;
    
    // Replace any non-standard Q/A format with the standard format
    formatted = formatted.replace(/^Question:?\s*/gim, 'Q: ');
    formatted = formatted.replace(/^Answer:?\s*/gim, 'A: ');
    
    // Ensure there's a separator between flashcards
    formatted = formatted.replace(/(?<!-)\n\s*Q:/g, '\n---\nQ:');
    
    // Add a separator at the beginning if it doesn't start with Q:
    if (!formatted.trim().startsWith('Q:')) {
      formatted = 'Q: ' + formatted.trim();
    }
    
    // Add a separator at the end if it doesn't end with one
    if (!formatted.trim().endsWith('---')) {
      formatted = formatted.trim() + '\n---';
    }
    
    return formatted;
  }
  
  /**
   * Generates flashcards from text with retry mechanism and model fallback
   * @param text The text to generate flashcards from
   * @returns Generated flashcards or error message
   */
  async generateCardsFromText(text: string): Promise<string> {
    // Validate input text
    if (!this.validateInputText(text)) {
      if (!text || text.trim().length === 0) {
        return 'Error: Please provide some text to generate flashcards from.';
      } else {
        return 'Error: The provided text is too long. Please provide a shorter text (maximum 4000 characters).';
      }
    }
    
    // Sanitize the input text
    const sanitizedText = this.sanitizeInputText(text);
    
    let retries = 0;
    let modelIndex = 0;
    
    const makeRequest = async (modelIndex: number): Promise<string> => {
      const currentModel = this.freeModels[modelIndex];
      
      try {
        const systemPrompt = 'You are a helpful assistant that generates high-quality flashcards from text.';
        const userPrompt = `Generate as many possible high-quality Q&A flashcards from the following text:

"""
${sanitizedText}
"""

Format:
Q: ...
A: ...
---
`;

        console.log(`Attempting to generate flashcards using model: ${currentModel}`);
        
        // Create a promise that rejects after timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Request timed out')), this.requestTimeout);
        });
        
        // Create the API request promise
        const apiRequestPromise = this.openai.chat.completions.create({
          model: currentModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.7,
          max_tokens: 1000
        }, {
          headers: {
              'HTTP-Referer': 'super-memo-app', // Optional: for OpenRouter analytics
              'X-Title': 'Super Memo Flashcard Generator', // Optional: for OpenRouter analytics
            },
        });
        
        // Race the API request against the timeout
        const response = await Promise.race([apiRequestPromise, timeoutPromise]);
        
        // Get the raw content from the response
        const rawContent = response.choices[0]?.message?.content || '';
        
        // Format the flashcards for consistent output
        return this.formatFlashcards(rawContent);
      } catch (error) {
        // If rate limited and we haven't exceeded max retries, retry after delay
        if (error.status === 429 && retries < this.maxRetries) {
          retries++;
          console.log(`Rate limited. Retrying (${retries}/${this.maxRetries}) after ${this.retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
          return makeRequest(modelIndex); // Recursive retry with same model
        }
        
        // If model-specific error and we have more models to try, try the next model
        if ((error.status === 404 || error.status === 400) && modelIndex < this.freeModels.length - 1) {
          console.log(`Model ${currentModel} failed. Trying next model...`);
          return makeRequest(modelIndex + 1); // Try next model
        }
        
        throw error; // Re-throw if not handled by retry or fallback
      }
    };
    
    try {
      return await makeRequest(0); // Start with the first model
    } catch (error) {
      console.error('Error generating flashcards:', error);
      
      // Provide more specific error messages for common issues
      if (error.status === 429) {
        return 'Rate limit exceeded. OpenRouter free models are limited to 20 requests per minute and 200 requests per day.';
      } else if (error.status === 401 || error.status === 403) {
        return 'Authentication error. Please check your OpenRouter API key in the .env file.';
      } else if (error.status === 402) {
        return 'Insufficient credits. Your OpenRouter account may have a negative balance.';
      } else if (error.message && error.message.includes('network')) {
        return 'Network error. Please check your internet connection.';
      } else if (error.message && error.message.includes('timed out')) {
        return 'The request timed out. The server might be experiencing high load or the model might be taking too long to respond. Please try again later with a shorter text.';
      } else if (error.message && error.message.includes('aborted')) {
        return 'The request was aborted. Please try again with a shorter text or a different model.';
      }
      
      return `Error generating flashcards: ${error.message}`;
    }
  }
}
