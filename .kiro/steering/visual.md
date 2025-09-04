# Visual Steering

## Design Philosophy

The app should look modern, clean, and intuitive.  
Design should prioritize simplicity for Etsy sellers who may not be technical.

## Style Guidelines

- **Layout**: Minimal, grid-based, with clear separation of sections
- **Typography**: Sans-serif fonts, consistent sizing hierarchy (xl for headers, base for text)
- **Colors**: Light mode default, soft neutrals with one accent color for primary actions
- **Spacing**: Generous padding and margin to avoid clutter
- **Corners & Shadows**: Rounded corners (2xl) with soft shadows for cards and modals
- **Animations**: Smooth transitions (e.g., fade, slide-in) using lightweight libraries like Framer Motion if React is used

## Frontend Rules

- **Framework**: HTML + Tailwind CSS (extend with React if needed)
- **Components**:
  - Buttons: Rounded, primary accent color for CTAs
  - Cards: Used for image previews, listings, and uploads
  - Modals: For confirmation dialogs and previews
- **Accessibility**: Ensure sufficient color contrast, alt text for images, and keyboard navigation

## Visual Consistency

- Every generated page or component should follow the above styling
- Use Tailwind utility classes for consistent design tokens
- Keep file upload and preview experience friendly, drag-and-drop preferred
