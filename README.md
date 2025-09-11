# Bexio Sync Buddy

A modern time tracking application built with React, TypeScript, and Capacitor for seamless integration with Bexio.

## Project Overview

This is a Capacitor-based mobile and web application for time tracking and project management, designed to work seamlessly with Bexio's API.

## Technologies Used

- **Frontend**: React 18, TypeScript, Vite
- **UI Framework**: shadcn/ui, Tailwind CSS
- **Mobile**: Capacitor (iOS/Android support)
- **State Management**: TanStack Query
- **Backend Integration**: Bexio API
- **Database**: Supabase

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Capacitor CLI: `npm install -g @capacitor/cli`

### Installation

1. Clone the repository:
```sh
git clone <YOUR_GIT_URL>
cd bexio-sync-buddy
```

2. Install dependencies:
```sh
npm install
```

3. Start the development server:
```sh
npm run dev
```

### Mobile Development

#### iOS
```sh
npx cap add ios
npx cap run ios
```

#### Android
```sh
npx cap add android
npx cap run android
```

### Building for Production

```sh
npm run build
npx cap sync
```

## Project Structure

```
src/
├── components/          # Reusable UI components
├── hooks/              # Custom React hooks
├── pages/              # Page components
├── context/            # React context providers
├── lib/                # Utility functions
└── integrations/       # External service integrations
```

## Features

- Time tracking with project and task management
- Mobile-optimized interface
- Bexio API integration
- Real-time data synchronization
- Analytics and reporting
- Multi-language support
- Haptic feedback on mobile devices

## Contributing

1. Create a new branch for your feature
2. Make your changes
3. Test on both web and mobile platforms
4. Submit a pull request

## License

This project is private and proprietary.
