# Project Structure

## Root Directory Layout
```
EtsySelfManagement/
├── .git/                # Git version control
├── .kiro/               # Kiro AI assistant configuration
│   └── steering/        # AI guidance documents
├── .vscode/             # VS Code workspace settings
├── LICENSE              # MIT License file
└── README.md            # Project documentation
├── client/              # client side code
├── server/              # server side backend code

```

## Organization Principles
- Keep root directory clean with only essential files
- Use standard dotfile conventions for tooling configuration
- Maintain clear separation between source code and configuration

## Future Structure Considerations
- Source code should be organized in logical modules
- Tests should be co-located with source code or in dedicated test directories
- Documentation should be easily discoverable
- Build artifacts should be excluded from version control

## File Naming Conventions
- Use clear, descriptive names
- Follow language-specific conventions when tech stack is chosen
- Maintain consistency across the project