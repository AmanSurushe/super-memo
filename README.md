# SuperMemo

<p align="center">
  <img src="https://img.shields.io/badge/version-0.0.1-blue" alt="Version" />
  <img src="https://img.shields.io/badge/license-UNLICENSED-red" alt="License" />
</p>

## What is SuperMemo?

SuperMemo is a terminal-based flashcard application that uses the SuperMemo 2 (SM2) algorithm for spaced repetition learning. It helps you efficiently memorize information by scheduling reviews at optimal intervals based on your recall performance.

## Features

### Current Features

- **AI-Powered Flashcard Generation**: Upload your notes, articles, or documents (.docx files), and let AI generate flashcards for you
- **Spaced Repetition Learning**: Uses the SM2 algorithm to optimize your learning and memory retention
- **Interest-Based Tagging**: Organize and filter cards by tags and interests
- **Note Management**: Add detailed notes to cards and optionally store them as markdown files
- **Visual Statistics**: View your learning progress with forgetting curves and review schedules
- **Terminal UI**: Simple and distraction-free interface for focused learning
- **File-Based Database**: Simple JSON storage for cards and user data
- **Performance Rating System**: Rate your recall from 0 (complete blackout) to 5 (perfect recall)

### Planned Features (Next Cycle)

1. **UI Development**
   - Add Next.js frontend for web interface
   - Maintain feature parity between CLI and UI
   - Responsive design for all devices

2. **User Management**
   - Keycloak authentication integration
   - Support for Google/Github auth (pinnacle.in emails only)
   - Role-based access control

3. **Database Migration**
   - Transition from file-based storage to PostgreSQL
   - Schema design for optimized spaced repetition
   - Data migration scripts

4. **AI Note Processing**
   - Notes-to-cards conversion via AI
   - Sentiment analysis on feedback
   - Version history for AI-generated content
   - Creativity level controls for AI responses

## Prerequisites

- Node.js (v16 or higher)
- npm (v7 or higher)
- OpenAI API key or HuggingFace API token for AI features

## Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd super-memo
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the root directory with your API keys:

```
OPENAI_API_KEY=your_openai_api_key
# OR
HUGGINGFACE_API_KEY=your_huggingface_api_token
```

## Getting Started

1. Build the project:

```bash
npm run build
```

2. Start the application:

```bash
npm start
```

3. Follow the terminal prompts to:
   - Add documents to the `/notes` folder (supports .docx files)
   - Generate flashcards from your documents
   - Review due cards
   - Manage your interests/tags
   - View learning statistics

## Usage Tips

- **Adding Content**: Place your .docx files in the `/notes` folder before generating flashcards
- **Rating System**: When reviewing cards, rate your recall from 0 (complete blackout) to 5 (perfect recall)
- **Custom Tags**: Add tags to organize your cards by topic or priority
- **Notes**: Add additional context or information to cards for better understanding

## Development

```bash
# Run in development mode with hot-reload
npm run start:dev

# Run tests
npm test
```

## License

This project is [UNLICENSED](LICENSE).

### Recent Updates

**Enhanced Spaced Repetition Algorithm (SM-2)**
- Implemented strict adherence to the original SM-2 algorithm requirements
- Cards with review ratings < 4 are now automatically re-queued for review in the same session
- Added immediate re-review loop until cards achieve at least a rating of 4
- Maintained all standard interval updates (n, EF, I) during re-reviews

**Key Behavior Changes**
1. When reviewing cards:
   - Ratings 0-3 will trigger immediate re-review
   - The card will be presented again until rated 4 or 5
   - Each review updates the card's memory parameters
2. Improved accuracy of ease factor calculations
3. More granular performance tracking with the full 0-5 rating scale
