# 🚀 Bexio Sync Buddy

> A modern, hybrid time tracking application built with React, TypeScript, and Capacitor for seamless Bexio integration.

[![React](https://img.shields.io/badge/React-18.2.0-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0.0-blue.svg)](https://www.typescriptlang.org/)
[![Capacitor](https://img.shields.io/badge/Capacitor-5.0.0-blue.svg)](https://capacitorjs.com/)
[![Vite](https://img.shields.io/badge/Vite-7.1.5-purple.svg)](https://vitejs.dev/)

## 📋 Table of Contents

- [✨ Features](#-features)
- [🏗️ Architecture](#️-architecture)
- [🚀 Quick Start](#-quick-start)
- [📱 Mobile Development](#-mobile-development)
- [🔧 Configuration](#-configuration)
- [📚 API Reference](#-api-reference)
- [🛠️ Development Commands](#️-development-commands)
- [🔍 Troubleshooting](#-troubleshooting)
- [📄 License](#-license)

## ✨ Features

- ⏱️ **Advanced Time Tracking** - Track time with projects, tasks, and clients
- 📱 **Hybrid Mobile App** - Native iOS/Android experience with Capacitor
- 🔐 **Secure OAuth Integration** - Direct Bexio API authentication
- 📊 **Real-time Analytics** - Comprehensive reporting and insights
- 🌍 **Multi-language Support** - English, German, French, Italian
- 📡 **Offline Capability** - Local data storage and sync
- 🎯 **Haptic Feedback** - Enhanced mobile user experience
- 🔄 **Auto-sync** - Seamless data synchronization with Bexio

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React App     │    │  Local OAuth    │    │     Bexio API   │
│   (Frontend)    │◄──►│     Server      │◄──►│   (Backend)     │
│                 │    │                 │    │                 │
│ • TypeScript    │    │ • Express.js    │    │ • REST API      │
│ • Vite          │    │ • PKCE OAuth    │    │ • GraphQL        │
│ • Capacitor     │    │ • Token Mgmt    │    │ • Webhooks       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **UI Components**: shadcn/ui, Radix UI, Lucide Icons
- **State Management**: TanStack Query, React Context
- **Mobile**: Capacitor (iOS/Android/Web)
- **Backend**: Express.js, Node.js
- **Authentication**: OAuth 2.0 with PKCE
- **API Integration**: Bexio REST API

## 🚀 Quick Start

### Prerequisites

- **Node.js** ≥ 18.0.0
- **npm** or **yarn**
- **Xcode** (for iOS development)
- **Android Studio** (for Android development)

### Installation

```bash
# 1. Clone the repository
git clone <YOUR_GIT_URL>
cd bexio-sync-buddy

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your Bexio OAuth credentials

# 4. Start development servers
npm run dev:full
```

**🎉 Your app will be running at:**
- **Web**: http://localhost:8081/
- **Backend API**: http://localhost:3001/

## 📱 Mobile Development

### iOS Development

```bash
# Add iOS platform
npm run cap:add:ios

# Build and run on iOS simulator
npm run cap:run:ios

# Build for production
npm run build:ios
```

### Android Development

```bash
# Add Android platform
npm run cap:add:android

# Build and run on Android emulator
npm run cap:run:android

# Build for production
npm run build:android
```

### iOS Build Commands

```bash
# Clean and rebuild iOS app
npm run cap:clean:ios

# Sync web assets to iOS
npm run cap:sync:ios

# Open Xcode project
npm run cap:open:ios

# Build iOS app archive
npm run cap:build:ios
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file with the following variables:

```env
# ===========================================
# BEXIO OAUTH CONFIGURATION
# ===========================================
BEXIO_CLIENT_ID=your_bexio_client_id_here
BEXIO_CLIENT_SECRET=your_bexio_client_secret_here

# Redirect URIs for different platforms
BEXIO_WEB_REDIRECT_URI=http://localhost:8081/oauth-complete.html
BEXIO_MOBILE_REDIRECT_URI=bexiosyncbuddy://oauth/callback

# ===========================================
# SERVER CONFIGURATION
# ===========================================
PORT=3001
CAPACITOR_SERVER_URL=http://localhost:8081
API_SERVER_URL=http://localhost:3001

# ===========================================
# DEVELOPMENT URLS
# ===========================================
DEV_SERVER_URL=http://localhost:8080
```

### Bexio OAuth Setup

1. **Create Bexio OAuth App** at https://developer.bexio.com/
2. **Add Redirect URIs**:
   - Web: `http://localhost:8081/oauth-complete.html`
   - Mobile: `bexiosyncbuddy://oauth/callback`
3. **Copy credentials** to your `.env` file

## 📚 API Reference

### Local OAuth Server Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/bexio-oauth/auth` | Initiate OAuth flow |
| `POST` | `/api/bexio-oauth/exchange` | Exchange code for tokens |
| `GET` | `/api/health` | Health check |
| `POST` | `/api/bexio-proxy` | Proxy Bexio API calls |

### Bexio API Integration

- **Contacts**: Full CRUD operations
- **Projects**: Project management
- **Time Entries**: Time tracking
- **Users**: User management
- **Business Activities**: Service catalog

## 🛠️ Development Commands

### Core Commands

```bash
# Start both frontend and backend
npm run dev:full

# Start only frontend (Vite)
npm run dev

# Start only backend (Express)
npm run server

# Build for production
npm run build

# Preview production build
npm run preview
```

### Mobile Commands

```bash
# iOS Commands
npm run cap:add:ios          # Add iOS platform
npm run cap:run:ios          # Run on iOS simulator
npm run cap:build:ios        # Build iOS app
npm run cap:sync:ios         # Sync web assets to iOS
npm run cap:open:ios         # Open Xcode project
npm run cap:clean:ios        # Clean iOS build

# Android Commands
npm run cap:add:android      # Add Android platform
npm run cap:run:android      # Run on Android emulator
npm run cap:build:android    # Build Android APK
npm run cap:sync:android     # Sync web assets to Android
npm run cap:open:android     # Open Android Studio
npm run cap:clean:android    # Clean Android build
```

### Utility Commands

```bash
# Lint and format code
npm run lint
npm run format

# Type checking
npm run type-check

# Test commands
npm run test
npm run test:watch
npm run test:coverage

# Database/Supabase commands (if using Supabase)
npm run supabase:start
npm run supabase:stop
npm run supabase:reset
```

### Environment Management

```bash
# Copy environment template
cp .env.example .env

# Validate environment variables
npm run env:check

# Generate new environment template
npm run env:generate
```

## 🔍 Troubleshooting

### Common Issues

#### 1. OAuth Connection Failed
```bash
# Check server is running
curl http://localhost:3001/api/health

# Check environment variables
cat .env | grep BEXIO

# Restart servers
npm run dev:full
```

#### 2. iOS Build Issues
```bash
# Clean iOS build
npm run cap:clean:ios

# Reinstall iOS dependencies
cd ios/App && pod install

# Reset iOS platform
npm run cap:add:ios --force
```

#### 3. Android Build Issues
```bash
# Clean Android build
npm run cap:clean:android

# Check Android SDK
android-studio --version

# Reset Android platform
npm run cap:add:android --force
```

#### 4. Network Issues
```bash
# Check your local IP
ipconfig getifaddr en0  # macOS
hostname -I             # Linux

# Update .env with correct IP
echo "Your IP: $(hostname -I)"
```

### Debug Mode

Enable detailed logging:

```bash
# Set debug environment
export DEBUG=bexio-sync-buddy:*

# Start with debug logs
npm run dev:full -- --log-level debug
```

### Performance Tips

- Use `npm run build` for production builds
- Enable service worker for caching
- Use lazy loading for components
- Optimize images and assets

## 📄 License

This project is private and proprietary.

---

**Built with ❤️ using modern web technologies**

**Need help?** Check the [troubleshooting](#-troubleshooting) section or create an issue.
# Force redeploy
