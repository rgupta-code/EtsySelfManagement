# Technology Stack

## Development Environment
- **IDE**: Visual Studio Code with Kiro AI Assistant Integration
- **Kiro Features Used**:
  - **Spec-to-Code** for structured development from requirements
  - **Agent Hooks** for automated workflows (docs, tests, linting, changelog)
  - **Agent Steering** to enforce coding standards and consistency
- **MCP Integration**: Enabled for enhanced AI capabilities

## Project Configuration
- **License**: MIT License
- **Version Control**: Git (public repository required for hackathon submission)
- **/.kiro Directory**: Includes spec, hooks, and steering configuration to guide development

## Build & Development Commands
- **Backend (Node.js)**:
  - `npm install` — install dependencies
  - `npm run dev` — run backend in development mode
  - `npm test` — run Jest test suite
- **Frontend (HTML/Vanilla JS or React if extended)**:
  - `npm run build` — build frontend assets
  - `npm start` — serve frontend with backend

## Dependencies
- **Backend**:
  - `express` — web framework
  - `sharp` or `jimp` — image processing (watermark, collage)
  - `archiver` — zip packaging
  - `googleapis` — Google Drive integration
  - `etsy-api-v3` (or custom wrapper) — Etsy draft listing creation
  - `@google/generative-ai` — Google Gemini API for AI-driven metadata (titles, descriptions, tags)
  - `jest` — testing framework
- **Frontend**:
  - HTML + Tailwind CSS 
  - Vanilla JS (or lightweight React if needed)
- **Tooling**:
  - `eslint` + `prettier` — linting and code formatting

## Architecture Notes
- **Frontend**: Web app for image upload and listing preview
- **Backend**: Node.js (Express) handles all processing:
  - Image watermarking and collage generation
  - Zip packaging and upload to Google Drive
  - AI metadata generation (title, tags, description)
  - Etsy draft listing creation
- **Kiro Steering Rules** (via `steering.yaml`):
  - Always use Node.js with Express for backend services
  - Use async/await style (no callbacks)
  - Enforce ESLint + Prettier formatting
  - Validate file uploads (size and type) for security
- **Development Workflow**:
  - Spec → Code generation with Kiro
  - Hooks automate documentation, testing, and changelog updates
  - Steering ensures consistent, production-quality code
