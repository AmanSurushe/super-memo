# Super-Memo Codebase Summary

## 1. Project Overview

**Project Name:** Super-Memo

**Primary Purpose:** Based on the directory structure and file names, this appears to be a spaced repetition system (SRS) application implementing the SuperMemo algorithm for effective learning and memorization.

**Key Features:**
- Card-based learning system
- AI integration (ai.service.ts)
- Data parsing capabilities (parser.service.ts)
- CLI interface (cli.service.ts)

**Current Status:** Active development (evidenced by test directory and recent package files)

## 2. Core Technologies & Stack

**Backend:**
- Node.js (package.json)
- NestJS framework (app.module.ts, nest-cli.json)
- TypeScript (tsconfig.json)

**Data Storage:**
- JSON-based storage (cards.json)

**Testing:**
- Jest (jest-e2e.json)

**Development Tools:**
- ESLint (eslint.config.mjs)
- Prettier (.prettierrc)

## 3. Architecture & Design Principles

**Architectural Pattern:**
- Modular monolith with NestJS

**Key Modules:**
- AI Service: Handles intelligent card scheduling
- Cards Service: Manages learning cards
- Parser Service: Processes input data
- CLI Service: Provides command-line interface

## 4. Setup & Development Environment

**Prerequisites:**
- Node.js
- npm/yarn

**Installation:**
1. Clone repository
2. Run `npm install`

**Running:**
- Start: `npm run start`
- Test: `npm test`

## 5. Directory Structure

- **src/**: Main application code
  - **ai/**: AI-related services
  - **cards/**: Card management
  - **cli/**: Command-line interface
  - **data/**: JSON data storage
  - **parser/**: Data parsing
- **test/**: End-to-end tests

## 6. Important Notes

**Future Plans:**
- Potential expansion suggested by AI service

**Contribution Guidelines:**
- Follow ESLint and Prettier rules
- Include tests for new features