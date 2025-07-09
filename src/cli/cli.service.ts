import { Injectable } from '@nestjs/common';
import inquirer from 'inquirer';
import * as fs from 'fs';
import * as path from 'path';
import * as fsPromises from 'fs/promises';
import { ParserService } from '../parser/parser.service';
import { AIService } from '../ai/ai.service';
import { Card, CardsService } from '../cards/cards.service';
import * as asciichart from 'asciichart';

@Injectable()
export class CliService {
  private notesPath = path.resolve('notes');
  private markdownPath = path.resolve('notes', 'markdown');
  private userInterests: string[] = [];

  constructor(
    private readonly parserService: ParserService,
    private readonly aiService: AIService,
    private readonly cardsService: CardsService,
  ) {}

  async run(): Promise<void> {
    // Create necessary folders
    await this.ensureFoldersExist();

    // Load user interests if they exist
    await this.loadUserInterests();

    // Main menu loop
    let exit = false;
    while (!exit) {
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: '🧠 SuperMemo - What would you like to do?',
          choices: [
            {
              name: '📝 Generate new flashcards from document',
              value: 'generate',
            },
            { name: '🔄 Review due cards', value: 'review' },
            { name: '🏷️ Manage interests/tags', value: 'tags' },
            { name: '📊 View statistics', value: 'stats' },
            { name: '📋 Manage notes', value: 'notes' },
            { name: '❌ Exit', value: 'exit' },
          ],
        },
      ]);

      switch (action) {
        case 'generate':
          await this.generateFlashcards();
          break;
        case 'review':
          await this.reviewCards();
          break;
        case 'tags':
          await this.manageInterests();
          break;
        case 'stats':
          await this.showStatistics();
          break;
        case 'notes':
          await this.manageNotes();
          break;
        case 'exit':
          console.log('👋 Goodbye!');
          exit = true;
          break;
      }
    }
  }

  private async ensureFoldersExist(): Promise<void> {
    // Create notes folder if it doesn't exist
    if (!fs.existsSync(this.notesPath)) {
      console.log('📂 Creating notes folder...');
      fs.mkdirSync(this.notesPath);
      console.log('📝 Please add some .docx files in the /notes folder.');
    }

    // Create markdown folder if it doesn't exist
    if (!fs.existsSync(this.markdownPath)) {
      console.log('📂 Creating markdown folder...');
      fs.mkdirSync(this.markdownPath);
    }
  }

  private async loadUserInterests(): Promise<void> {
    try {
      const interestsPath = path.join(this.notesPath, 'interests.json');
      if (fs.existsSync(interestsPath)) {
        const data = await fsPromises.readFile(interestsPath, 'utf8');
        this.userInterests = JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading user interests:', error.message);
      this.userInterests = [];
    }
  }

  private async saveUserInterests(): Promise<void> {
    try {
      const interestsPath = path.join(this.notesPath, 'interests.json');
      await fsPromises.writeFile(
        interestsPath,
        JSON.stringify(this.userInterests, null, 2),
      );
    } catch (error) {
      console.error('Error saving user interests:', error.message);
    }
  }

  private async generateFlashcards(): Promise<void> {
    const files = fs
      .readdirSync(this.notesPath)
      .filter((file) => file.endsWith('.docx'));

    if (files.length === 0) {
      console.log('❌ No .docx files found in ./notes.');
      return;
    }

    // Ask user to select a file
    const { selectedFile }: { selectedFile: string } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedFile',
        message: '📄 Select a file to generate flashcards from:',
        choices: files,
      },
    ]);

    const fullPath = path.join(this.notesPath, selectedFile);
    const docText = await this.parserService.extractText(fullPath);

    // Confirm generation
    const { confirm }: { confirm: boolean } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: '🧠 Generate flashcards from this document?',
      },
    ]);

    if (!confirm) {
      console.log('⚠️ Operation cancelled.');
      return;
    }

    // Generate and save flashcards
    console.log('🤖 Generating flashcards with AI...');
    const rawCards = await this.aiService.generateCardsFromText(docText);
    const saved = await this.cardsService.saveRawCards(rawCards);

    console.log(`✅ ${saved.length} flashcards saved to cards.json`);

    // Ask if user wants to tag the new cards
    const { tagCards }: { tagCards: boolean } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'tagCards',
        message: '🏷️ Would you like to add tags to these new cards?',
      },
    ]);

    if (tagCards) {
      for (const card of saved) {
        if (card) {
          // Check if card is not null
          await this.tagCard(card);
        }
      }
    }
  }

  private async reviewCards(): Promise<void> {
    // Get due cards
    const dueCards = await this.cardsService.getDueCards();

    if (dueCards.length === 0) {
      console.log('✅ No cards due for review. Great job!');
      return;
    }

    console.log(`📚 You have ${dueCards.length} cards due for review.`);

    // Ask if user want to filter by tags
    const { filterByTags }: { filterByTags: boolean } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'filterByTags',
        message: '🏷️ Would you like to filter cards by tags?',
        default: this.userInterests.length > 0,
      },
    ]);

    let cardsToReview = dueCards;

    if (filterByTags) {
      const { selectedTags } = (await inquirer.prompt({
        type: 'checkbox',
        name: 'selectedTags',
        message: 'Select tags to filter by:',
        choices: this.userInterests,
      })) as { selectedTags: string[] };

      if (selectedTags.length > 0) {
        cardsToReview = await this.cardsService.getCardsByTags(selectedTags);
        // Filter to only include due cards
        const now = new Date();
        cardsToReview = cardsToReview.filter(
          (card) => new Date(card.dueDate) <= now,
        );
      }
    }

    if (cardsToReview.length === 0) {
      console.log('❌ No cards match your filter criteria.');
      return;
    }

    console.log(`📝 Reviewing ${cardsToReview.length} cards...`);

    // Review each card
    for (const card of cardsToReview) {
      await this.reviewSingleCard(card);
    }

    console.log('✅ Review session complete!');
  }

  private async reviewSingleCard(card: Card): Promise<void> {
    let needsReview = true;

    while (needsReview) {
      console.log('\n-----------------------------------');
      console.log(`Question: ${card.question}`);

      // Prompt user to show answer
      await inquirer.prompt([
        {
          type: 'input',
          name: 'showAnswer',
          message: 'Press Enter to show answer...',
        },
      ]);

      console.log(`Answer: ${card.answer}`);

      if (card.notes) {
        console.log(`Notes: ${card.notes}`);
      }

      // Get user rating
      const { rating }: { rating: number } = await inquirer.prompt([
        {
          type: 'list',
          name: 'rating',
          message: 'How well did you remember this? (0-5)',
          choices: [
            { name: '0 - Complete blackout', value: 0 },
            { name: '1 - Wrong answer, but recognized', value: 1 },
            { name: '2 - Wrong answer, but close', value: 2 },
            { name: '3 - Correct with difficulty', value: 3 },
            { name: '4 - Correct with some hesitation', value: 4 },
            { name: '5 - Perfect recall', value: 5 },
          ],
        },
      ]);

      // Update card using SM2 algorithm
      const result = await this.cardsService.reviewCard(card.id, rating);

      // Show next review date
      const nextReview = new Date(result.card.dueDate);
      console.log(`Next review: ${nextReview.toLocaleDateString()}`);

      // Check if card needs re-review
      if (result.needsReReview) {
        console.log('⚠️  This card needs immediate re-review (rating < 4)');
        // Update the card object with the latest changes
        Object.assign(card, result.card);
      } else {
        needsReview = false;
      }
    }

    // Ask if user wants to add/update notes
    const { manageNotes }: { manageNotes: boolean } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'manageNotes',
        message: '📝 Would you like to add/update notes for this card?',
        default: false,
      },
    ]);

    if (manageNotes) {
      await this.addNotesToCard(card);
    }
  }

  private async manageInterests(): Promise<void> {
    const { action }: { action: string } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: '🏷️ Manage Interests/Tags',
        choices: [
          { name: '👀 View current interests', value: 'view' },
          { name: '➕ Add new interest', value: 'add' },
          { name: '❌ Remove interest', value: 'remove' },
          { name: '🔙 Back to main menu', value: 'back' },
        ],
      },
    ]);

    switch (action) {
      case 'view':
        if (this.userInterests.length === 0) {
          console.log('❌ No interests defined yet.');
        } else {
          console.log('🏷️ Your interests:');
          this.userInterests.forEach((interest, index) => {
            console.log(`${index + 1}. ${interest}`);
          });
        }
        break;
      case 'add':
        const { newInterest }: { newInterest: string } = await inquirer.prompt([
          {
            type: 'input',
            name: 'newInterest',
            message: 'Enter a new interest/tag:',
            validate: (input) =>
              input.trim().length > 0 || 'Interest cannot be empty',
          },
        ]);
        if (!this.userInterests.includes(newInterest)) {
          this.userInterests.push(newInterest);
          await this.saveUserInterests();
          console.log(`✅ Added "${newInterest}" to your interests.`);
        } else {
          console.log(`⚠️ "${newInterest}" is already in your interests.`);
        }
        break;
      case 'remove':
        if (this.userInterests.length === 0) {
          console.log('❌ No interests to remove.');
          break;
        }
        const { interestToRemove }: { interestToRemove: string } =
          await inquirer.prompt([
            {
              type: 'list',
              name: 'interestToRemove',
              message: 'Select an interest to remove:',
              choices: this.userInterests,
            },
          ]);
        this.userInterests = this.userInterests.filter(
          (i) => i !== interestToRemove,
        );
        await this.saveUserInterests();
        console.log(`✅ Removed "${interestToRemove}" from your interests.`);
        break;
      case 'back':
        return;
    }

    // Return to interests menu
    await this.manageInterests();
  }

  private async tagCard(card: Card): Promise<void> {
    console.log(`\nTagging card: ${card.question}`);

    // Show existing tags if any
    if (card.tags && card.tags.length > 0) {
      console.log('Current tags:', card.tags.join(', '));
    }

    // Let user select from existing interests or add new ones
    const { selectedTags } = (await inquirer.prompt({
      type: 'checkbox',
      name: 'selectedTags',
      message: 'Select tags for this card:',
      choices: this.userInterests.map((interest) => ({
        name: interest,
        value: interest,
        checked: card.tags?.includes(interest) || false,
      })),
    })) as { selectedTags: string[] };

    // Ask if user wants to add custom tags not in interests
    const { addCustom } = (await inquirer.prompt({
      type: 'confirm',
      name: 'addCustom',
      message: 'Would you like to add custom tags?',
      default: false,
    })) as { addCustom: boolean };

    let finalTags = [...selectedTags];

    if (addCustom) {
      const { customTags } = (await inquirer.prompt({
        type: 'input',
        name: 'customTags',
        message: 'Enter custom tags (comma separated):',
      })) as { customTags: string };

      const newTags = customTags
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      finalTags = [...finalTags, ...newTags];

      // Ask if user wants to add these custom tags to interests
      const { addToInterests }: { addToInterests: boolean } =
        await inquirer.prompt([
          {
            type: 'confirm',
            name: 'addToInterests',
            message:
              'Would you like to add these custom tags to your interests?',
            default: true,
          },
        ]);

      if (addToInterests) {
        for (const tag of newTags) {
          if (!this.userInterests.includes(tag)) {
            this.userInterests.push(tag);
          }
        }
        await this.saveUserInterests();
      }
    }

    // Update card tags
    await this.cardsService.updateCardTags(card.id, finalTags);
    console.log(`✅ Updated tags for card.`);
  }

  private async showStatistics(): Promise<void> {
    console.log('📊 Generating statistics...');
    const stats = await this.cardsService.getCardStats();

    console.log('\n===== SuperMemo Statistics =====');
    console.log(`Total cards: ${stats.totalCards}`);
    console.log(`Cards due for review: ${stats.dueCards}`);
    console.log(`Average ease factor: ${stats.avgEaseFactor.toFixed(2)}`);

    // Performance distribution
    console.log('\n📈 Performance Distribution:');
    const ratings = ['0', '1', '2', '3', '4', '5'];
    const data = stats.performanceDistribution;

    // Create a simple ASCII bar chart
    const maxValue = Math.max(...data);
    const scale = 40 / (maxValue || 1); // Scale to max width of 40 chars

    ratings.forEach((rating, i) => {
      const value = data[i];
      const bar = '█'.repeat(Math.round(value * scale));
      console.log(`Rating ${rating}: ${bar} (${value})`);
    });

    // Upcoming reviews
    console.log('\n📅 Upcoming Reviews:');
    const upcomingDates = Object.keys(stats.upcomingReviews).sort();

    if (upcomingDates.length === 0) {
      console.log('No upcoming reviews scheduled.');
    } else {
      const upcomingData = upcomingDates.map(
        (date) => stats.upcomingReviews[date],
      );
      console.log(asciichart.plot(upcomingData, { height: 10 }));

      // Show date labels
      const dateLabels = upcomingDates.map((date) => {
        const d = new Date(date);
        return `${d.getMonth() + 1}/${d.getDate()}`;
      });

      // Print date labels with spacing to match chart
      console.log(dateLabels.join(' ').padStart(dateLabels.length * 2));
    }

    // Wait for user to continue
    await inquirer.prompt([
      {
        type: 'input',
        name: 'continue',
        message: 'Press Enter to continue...',
      },
    ]);
  }

  private async manageNotes(): Promise<void> {
    // Get all cards
    const allCards = await this.cardsService.load();

    if (allCards.length === 0) {
      console.log('❌ No cards found.');
      return;
    }

    // Ask user to select a card
    const { selectedCardId }: { selectedCardId: string } =
      await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedCardId',
          message: 'Select a card to manage notes:',
          choices: allCards.map((card) => ({
            name: `${card.question.substring(0, 50)}${card.question.length > 50 ? '...' : ''}`,
            value: card.id,
          })),
          pageSize: 10,
        },
      ]);

    const selectedCard = allCards.find((card) => card.id === selectedCardId);
    if (selectedCard) {
      await this.addNotesToCard(selectedCard);
    }
  }

  private async addNotesToCard(card: Card): Promise<void> {
    console.log(`\nAdding notes to card: ${card.question}`);

    // Show existing notes if any
    if (card.notes) {
      console.log('Current notes:', card.notes);
    }

    const { action }: { action: string } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: '✏️ Edit notes directly', value: 'edit' },
          { name: '📄 Create/edit markdown file', value: 'markdown' },
          { name: '🔙 Back', value: 'back' },
        ],
      },
    ]);

    switch (action) {
      case 'edit':
        const { notes }: { notes: string } = await inquirer.prompt([
          {
            type: 'editor',
            name: 'notes',
            message: 'Enter notes for this card:',
            default: card.notes || '',
          },
        ]);

        await this.cardsService.updateCardNotes(card.id, notes);
        console.log('✅ Notes updated successfully.');
        break;

      case 'markdown':
        // Create a markdown file for this card if it doesn't exist
        const filename = `${card.id}.md`;
        const filePath = path.join(this.markdownPath, filename);

        let existingContent = '';
        if (fs.existsSync(filePath)) {
          existingContent = await fsPromises.readFile(filePath, 'utf8');
        } else {
          // Create a new markdown file with card info
          existingContent = `# ${card.question}\n\n${card.answer}\n\n## Notes:\n\n`;
          await fsPromises.writeFile(filePath, existingContent);
        }

        // Tell user where the file is located
        console.log(`📝 Markdown file created at: ${filePath}`);
        console.log('Please edit this file and then return to the app.');

        // Wait for user to edit the file
        await inquirer.prompt([
          {
            type: 'input',
            name: 'continue',
            message: 'Press Enter when you have finished editing the file...',
          },
        ]);

        // Read the updated file and extract notes
        try {
          const updatedContent = await fsPromises.readFile(filePath, 'utf8');
          // Extract notes section (everything after ## Notes:)
          const notesMatch = updatedContent.match(/## Notes:\s*\n([\s\S]*)/i);
          const extractedNotes = notesMatch ? notesMatch[1].trim() : '';

          // Update card notes
          await this.cardsService.updateCardNotes(card.id, extractedNotes);
          console.log('✅ Notes updated from markdown file.');
        } catch (error) {
          console.error('Error reading markdown file:', error.message);
        }
        break;

      case 'back':
        return;
    }
  }
}