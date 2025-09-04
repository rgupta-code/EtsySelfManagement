# Etsy Listing Management

A self-management web application designed for Etsy sellers to streamline their business operations.

## Features

- Upload images to generate watermarked versions and collages
- Automatic packaging of original files into a zip and upload to Google Drive
- AI-generated titles, descriptions, and tags for Etsy listings
- Draft listing creation in Etsy with all assets included

## Project Structure

```
EtsySelfManagement/
├── client/              # Frontend code (HTML, CSS, JS)
│   ├── js/             # JavaScript modules
│   └── index.html      # Main HTML file
├── server/             # Backend Node.js code
│   ├── routes/         # Express routes
│   ├── services/       # Business logic services
│   └── app.js          # Main server entry point
├── .kiro/              # Kiro AI assistant configuration
└── package.json        # Project dependencies and scripts
```

## Setup

1. Copy environment template:
   ```bash
   cp .env.template .env
   ```

2. Fill in your API keys and configuration in `.env`

3. Install dependencies:
   ```bash
   npm install
   ```

4. Run in development mode:
   ```bash
   npm run dev
   ```

## Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with auto-reload
- `npm test` - Run test suite
- `npm run lint` - Check code style
- `npm run format` - Format code with Prettier

## License

MIT License