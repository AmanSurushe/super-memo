import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

export interface Card {
  id: string;
  question: string;
  answer: string;
  EF: number; // Ease Factor
  interval: number; // Current interval in days
  repetition: number; // Number of times card has been reviewed
  dueDate: string; // ISO string date when card is due for review
  tags?: string[]; // Optional tags for filtering
  notes?: string; // Optional additional notes
  lastReview?: string; // ISO string date of last review
  performance?: number[]; // Array of past performance ratings
  lastRating?: number; // Add this field to track most recent rating
}

@Injectable()
export class CardsService {
  private file = 'src/data/cards.json';

  async saveRawCards(raw: string) {
    const parsed = this.parseCards(raw);
    const existing = await this.load();
    const updated = [...existing, ...parsed];
    await fs.writeFile(this.file, JSON.stringify(updated, null, 2));
    return parsed;
  }

  private parseCards(raw: string) {
    const blocks = raw.split(/\n---\n/);
    return blocks
      .map(block => {
        const q = block.match(/Q:\s*(.+)/)?.[1];
        const a = block.match(/A:\s*(.+)/)?.[1];
        if (!q || !a) return null;
        return {
          id: uuidv4(),
          question: q,
          answer: a,
          EF: 2.5,
          interval: 0,
          repetition: 0,
          dueDate: new Date().toISOString(),
          tags: [],
          performance: [],
        };
      })
      .filter(Boolean);
  }

  async load() {
    try {
      const data = await fs.readFile(this.file, 'utf8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  /**
   * Get all cards due for review
   */
  async getDueCards(includeFailed: boolean = true) {
    const cards = await this.load();
    const now = new Date();
    
    // Get all due cards
    const dueCards = cards.filter(card => new Date(card.dueDate) <= now);
    
    if (includeFailed) {
      // Prioritize failed cards from current session
      const failedCards = dueCards.filter(card => 
        card.lastRating !== undefined && card.lastRating <= 2
      );
      
      // Then difficult cards from current session
      const difficultCards = dueCards.filter(card =>
        card.lastRating === 3
      );
      
      // Combine with remaining due cards
      return [
        ...failedCards,
        ...difficultCards,
        ...dueCards.filter(card => 
          card.lastRating === undefined || card.lastRating > 3
        )
      ];
    }
    
    return dueCards;
  }

  /**
   * Get all cards filtered by tags
   */
  async getCardsByTags(tags: string[]) {
    const cards = await this.load();
    if (!tags || tags.length === 0) return cards;

    return cards.filter(card => {
      if (!card.tags) return false;
      return tags.some(tag => card.tags.includes(tag));
    });
  }

  /**
   * Calculate new ease factor using SM-2 algorithm
   */
  private calculateNewEF(currentEF: number, rating: number): number {
    return currentEF + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02));
  }

  /**
   * Update card with review information using SuperMemo 2 algorithm
   * @param cardId The ID of the card to update
   * @param rating User rating from 0-5
   * @returns Updated card with review result
   */
  async reviewCard(cardId: string, rating: number) {
    const cards = await this.load();
    const cardIndex = cards.findIndex(c => c.id === cardId);
  
    if (cardIndex === -1) throw new Error('Card not found');
  
    const card = cards[cardIndex];
  
    // Store the rating before updating other fields
    card.lastRating = rating;
  
    // Store performance history
    if (!card.performance) card.performance = [];
    card.performance.push(rating);

    // Update last review date
    card.lastReview = new Date().toISOString();

    // Calculate new EF (applies to all ratings)
    const newEF = this.calculateNewEF(card.EF, rating);
    card.EF = Math.max(1.3, newEF); // EF should never be less than 1.3

    if (rating >= 3) {
      // Successful recall
      if (card.repetition === 0) {
        card.interval = 1; // 1 day
      } else if (card.repetition === 1) {
        card.interval = 6; // 6 days
      } else {
        // Use the formula: interval = interval * EF
        card.interval = Math.round(card.interval * card.EF);
      }
      card.repetition += 1;
    } else {
      // Failed recall - reset
      card.repetition = 0;
      card.interval = 1;
    }

    // Calculate next due date
    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() + card.interval);
    card.dueDate = nextDueDate.toISOString();

    // Update card in the array
    cards[cardIndex] = card;

    // Save updated cards
    await fs.writeFile(this.file, JSON.stringify(cards, null, 2));

    return {
      card,
      needsReReview: rating < 4 // Flag for cards that need immediate re-review
    };
  }

  /**
   * Add or update tags for a card
   */
  async updateCardTags(cardId: string, tags: string[]) {
    const cards = await this.load();
    const cardIndex = cards.findIndex(c => c.id === cardId);

    if (cardIndex === -1) {
      throw new Error(`Card with ID ${cardId} not found`);
    }

    cards[cardIndex].tags = tags;
    await fs.writeFile(this.file, JSON.stringify(cards, null, 2));

    return cards[cardIndex];
  }

  /**
   * Add or update notes for a card
   */
  async updateCardNotes(cardId: string, notes: string) {
    const cards = await this.load();
    const cardIndex = cards.findIndex(c => c.id === cardId);

    if (cardIndex === -1) {
      throw new Error(`Card with ID ${cardId} not found`);
    }

    cards[cardIndex].notes = notes;
    await fs.writeFile(this.file, JSON.stringify(cards, null, 2));

    return cards[cardIndex];
  }

  /**
   * Get statistics for visualization
   */
  async getCardStats() {
    const cards = await this.load();

    // Calculate statistics for visualization
    const stats = {
      totalCards: cards.length,
      dueCards: cards.filter(card => new Date(card.dueDate) <= new Date()).length,
      avgEaseFactor: cards.reduce((sum, card) => sum + card.EF, 0) / cards.length || 0,
      reviewsByDay: {} as Record<string, number>,
      upcomingReviews: {} as Record<string, number>,
      performanceDistribution: [0, 0, 0, 0, 0, 0], // Count of ratings 0-5
    };

    // Calculate reviews by day (past 30 days)
    const past30Days = new Date();
    past30Days.setDate(past30Days.getDate() - 30);

    cards.forEach(card => {
      // Count performance ratings
      if (card.performance) {
        card.performance.forEach(rating => {
          if (rating >= 0 && rating <= 5) {
            stats.performanceDistribution[rating]++;
          }
        });
      }

      // Count reviews by day
      if (card.lastReview) {
        const reviewDate = new Date(card.lastReview).toISOString().split('T')[0];
        stats.reviewsByDay[reviewDate] = (stats.reviewsByDay[reviewDate] || 0) + 1;
      }

      // Count upcoming reviews (next 30 days)
      if (card.dueDate) {
        const dueDate = new Date(card.dueDate);
        const now = new Date();
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(now.getDate() + 30);

        if (dueDate >= now && dueDate <= thirtyDaysFromNow) {
          const dueDateStr = dueDate.toISOString().split('T')[0];
          stats.upcomingReviews[dueDateStr] = (stats.upcomingReviews[dueDateStr] || 0) + 1;
        }
      }
    });

    return stats;
  }

}