# Etsy Listing Management

A self-management web application designed for Etsy sellers to streamline their business operations. Built with modern web technologies and enhanced by AI-powered development tools.

## 🚀 Features

- **Image Processing**: Upload images to generate watermarked versions and collages
- **Automated Packaging**: Zip original files and upload to Google Drive automatically
- **AI-Powered Metadata**: Generate titles, descriptions, and tags using Google Gemini AI
- **Etsy Integration**: Create draft listings directly in your Etsy shop
- **Contact Form**: EmailJS-powered contact form for user support and feedback
- **Modern UI**: Clean, responsive interface built with Tailwind CSS
- **Secure Authentication**: OAuth integration with Google Drive and Etsy APIs

## 🤖 Kiro AI Development Features

This project leverages advanced AI development capabilities through Kiro:

### **Spec-to-Code Development**
- Structured development from requirements using Kiro's spec system
- Incremental feature development with control and feedback
- Automated code generation following project specifications

### **Agent Hooks**
- **Code Analyzer**: Automatically analyzes code quality and suggests improvements when files are modified
- **Task Synchronization**: Updates GitHub issue status when features are implemented or completed
- **Task Completion Commit**: When a task is marked as completed in `tasks.md`, automatically stages all changes and requests user permission to commit

### **Agent Steering**
- **Coding Standards**: Enforces consistent Node.js/Express patterns using async/await
- **Visual Guidelines**: Maintains modern, clean UI design with Tailwind CSS principles
- **Architecture Rules**: Ensures proper separation of concerns and security best practices
- **Technology Stack**: Guides development using specified tech stack (Node.js, Express, Sharp/Jimp)

### **MCP Integration**
This project utilizes multiple Model Context Protocol servers for enhanced development capabilities:

#### **GitHub MCP**
- **Issue Management**: Create, update, and track GitHub issues directly from Kiro
- **Pull Request Workflow**: Automated PR creation and status updates
- **Repository Operations**: Branch management, file operations, and commit automation
- **Project Tracking**: Sync development progress with GitHub project boards

#### **PostgreSQL MCP**
- **Database Operations**: Query execution and schema management
- **Performance Analysis**: Query optimization and index recommendations
- **Health Monitoring**: Database health checks and performance metrics

#### **TestSprite MCP**
- **Automated Testing**: Generate and execute comprehensive test suites
- **Test Planning**: Create structured test plans for frontend and backend
- **Code Coverage**: Monitor test coverage and identify gaps
- **Integration Testing**: End-to-end testing capabilities

#### **Pexels MCP**
- **Stock Images**: Access to high-quality stock photos for UI mockups
- **Asset Management**: Download and organize visual assets
- **Design Resources**: Curated photo collections for design inspiration

## 📁 Project Structure

```
EtsySelfManagement/
├── .kiro/                    # Kiro AI configuration
│   ├── steering/            # AI guidance documents
│   ├── hooks/               # Automated workflow triggers
│   └── specs/               # Feature specifications
├── client/                  # Frontend application
│   ├── css/                # Tailwind CSS styles
│   ├── js/                 # JavaScript modules
│   ├── images/             # Static assets
│   └── *.html              # HTML pages
├── server/                  # Backend Node.js application
│   ├── config/             # Configuration files
│   ├── middleware/         # Express middleware
│   ├── routes/             # API endpoints
│   ├── services/           # Business logic
│   └── utils/              # Utility functions
├── scripts/                 # Build and setup scripts
├── test-data/              # Test fixtures
└── coverage/               # Test coverage reports
```

## 🛠️ Prerequisites

Before running this application, ensure you have the following installed:

### Required Software
- **Node.js** (v18.0.0 or higher)
- **npm** (comes with Node.js)
- **FFmpeg** (for advanced image/video processing)

### FFmpeg Installation

**Windows:**
```bash
# Using Chocolatey
choco install ffmpeg

# Or download from https://ffmpeg.org/download.html
```

**macOS:**
```bash
# Using Homebrew
brew install ffmpeg
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install ffmpeg
```

### Docker (Optional)
For containerized deployment:
```bash
# Install Docker Desktop from https://www.docker.com/products/docker-desktop/
```

## ⚙️ Setup Instructions

### 1. Clone and Install
```bash
git clone <repository-url>
cd EtsySelfManagement
npm install
```

### 2. Environment Configuration
```bash
# Copy the environment template
cp .env.template .env

# Edit .env with your API credentials (see API Setup section below)
```

### 3. API Setup

#### Google Drive API Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Google Drive API
4. Create credentials (OAuth 2.0 Client ID)
5. Add authorized redirect URI: `http://localhost:3000/api/auth/google/callback`
6. Copy Client ID and Client Secret to `.env`

#### Google Gemini AI Setup
1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create an API key for Gemini

#### EmailJS Setup (Contact Form)
1. Create account at [EmailJS.com](https://www.emailjs.com/)
2. Set up email service and template
3. Get Service ID, Template ID, and Public Key
4. Update `.env` with EmailJS credentials

For detailed EmailJS setup instructions, see [EMAILJS_SETUP.md](EMAILJS_SETUP.md)
3. Add the key to `.env` as `GOOGLE_AI_API_KEY`

#### Etsy API Setup
1. Go to [Etsy Developer Portal](https://www.etsy.com/developers/)
2. Create a new app
3. Get your Client ID and Client Secret
4. Set redirect URI: `http://localhost:3000/api/auth/etsy/callback`
5. Add credentials to `.env`

### 4. MCP Server Configuration

This project uses several MCP servers for enhanced development capabilities. The configuration is managed in `.kiro/settings/mcp.json`:

```json
{
  "mcpServers": {
    "github": {
      "command": "uvx",
      "args": ["mcp-server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "your_github_token_here"
      }
    },
    "postgres": {
      "command": "uvx", 
      "args": ["mcp-server-postgres"],
      "env": {
        "POSTGRES_CONNECTION_STRING": "postgresql://user:pass@localhost:5432/dbname"
      }
    },
    "testsprite": {
      "command": "uvx",
      "args": ["testsprite-mcp-server"]
    },
    "pexels": {
      "command": "uvx",
      "args": ["mcp-server-pexels"],
      "env": {
        "PEXELS_API_KEY": "your_pexels_api_key_here"
      }
    }
  }
}
```

**MCP Prerequisites:**
- Install `uv` and `uvx`: Follow [uv installation guide](https://docs.astral.sh/uv/getting-started/installation/)
- Get GitHub Personal Access Token from [GitHub Settings](https://github.com/settings/tokens)
- Get Pexels API key from [Pexels API](https://www.pexels.com/api/)

### 5. Environment Variables
Update your `.env` file with the following:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Google Drive API
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# Google Gemini AI
GOOGLE_AI_API_KEY=your_google_ai_api_key_here

# Etsy API
ETSY_CLIENT_ID=your_etsy_client_id_here
ETSY_CLIENT_SECRET=your_etsy_client_secret_here
ETSY_REDIRECT_URI=http://localhost:3000/api/auth/etsy/callback

# Security
JWT_SECRET=your_secure_jwt_secret_here
SESSION_SECRET=your_secure_session_secret_here
```

## 🚀 Running the Application

### Development Mode
```bash
# Start with auto-reload
npm run dev

# Or start server and client separately
npm run dev:server
npm run dev:client
```

### Production Mode
```bash
# Build and start
npm run build
npm start

# Or direct production start
npm run serve:prod
```

### Using Docker
```bash
# Build Docker image
docker build -t etsy-listing-management .

# Run container
docker run -p 3000:3000 --env-file .env etsy-listing-management
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run integration tests
npm run test:integration

# Run unit tests only
npm run test:unit

# Watch mode for development
npm run test:watch
```

## 📝 Available Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Start production server |
| `npm run dev` | Development mode with auto-reload |
| `npm test` | Run test suite |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run lint` | Check code style |
| `npm run lint:fix` | Fix linting issues |
| `npm run format` | Format code with Prettier |
| `npm run build` | Build for production |
| `npm run clean` | Clean build artifacts |
| `npm run validate` | Run all quality checks |

## 🔧 Development Workflow

This project uses Kiro AI for enhanced development with automated workflows:

### **Automated Development Process**

1. **Feature Development**: Use Kiro specs to define and implement features
2. **Code Analysis**: Agent hooks automatically analyze code quality on file changes
3. **Task Management**: GitHub issues are automatically updated when features are completed
4. **Quality Assurance**: Automated testing and formatting ensure code standards
5. **Version Control**: Task completion triggers automatic commit staging with user approval

### **Agent Hook Workflows**

#### **Code Analyzer Hook**
- **Trigger**: File save events on `.js`, `.html`, `.css` files
- **Actions**: 
  - Runs ESLint and Prettier checks
  - Analyzes code complexity and suggests improvements
  - Validates security best practices
  - Updates code documentation

#### **Task Synchronization Hook**
- **Trigger**: Feature implementation completion
- **Actions**:
  - Scans code for completed feature markers
  - Updates corresponding GitHub issue status
  - Adds implementation notes to issue comments
  - Moves tasks through project board columns

#### **Task Completion Commit Hook**
- **Trigger**: Task marked as completed in `tasks.md`
- **Actions**:
  - Stages all modified files
  - Generates descriptive commit message
  - Requests user permission before committing
  - Links commit to GitHub issue

### **Development Best Practices**
- Use descriptive commit messages linked to GitHub issues
- Follow the established coding standards enforced by Agent Steering
- Leverage MCP integrations for external service operations
- Maintain task tracking in `tasks.md` for automated workflows

## 📚 API Documentation

The application provides RESTful APIs for:
- `/api/auth/*` - Authentication endpoints
- `/api/upload` - File upload and processing
- `/api/listings` - Etsy listing management
- `/api/drive` - Google Drive integration
- `/api/ai` - AI metadata generation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes following the project's coding standards
4. Run tests and ensure they pass
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Troubleshooting

### Common Issues

**FFmpeg not found:**
- Ensure FFmpeg is installed and in your system PATH
- Restart your terminal after installation

**API Authentication errors:**
- Verify all API credentials in `.env`
- Check redirect URIs match exactly
- Ensure APIs are enabled in respective consoles

**Port already in use:**
- Change PORT in `.env` to an available port
- Kill existing processes using the port

**File upload issues:**
- Check file size limits in `.env`
- Verify file types are allowed
- Ensure temp directory has write permissions

For more help, check the [DEVELOPMENT.md](DEVELOPMENT.md) guide or open an issue.

## 🌐 GitHub Pages Deployment

You can deploy the frontend as a static demo site on GitHub Pages:

### Quick Deploy
1. Push your code to a public GitHub repository
2. Go to **Settings** → **Pages** in your repository
3. Select **GitHub Actions** as the source
4. The site will automatically deploy to `https://yourusername.github.io/repositoryname`

### What's Included in Static Mode
- ✅ Full UI and navigation
- ✅ Form interfaces and styling
- ⚠️ Simulated upload and API responses (demo mode)
- ❌ No backend functionality (image processing, integrations)

See [GITHUB_PAGES_SETUP.md](GITHUB_PAGES_SETUP.md) for detailed deployment instructions.