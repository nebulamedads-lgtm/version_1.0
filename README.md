# TransHere - Version 1.0

A high-performance, mobile-first landing page for X (Twitter) to OnlyFans/Fansly conversion, built with Next.js 15 and deployed on Cloudflare Pages.

## Features

- **Instagram-Style Stories**: 7-day decay, pinned groups, inter-model navigation
- **Visual Memory System**: Tracks viewed profiles and stories using localStorage
- **Category Filtering**: Top 15 most-used tags with frequency-based sorting
- **Real-Time Sync**: Cross-tab/window synchronization for favorites and viewed content
- **Dark Mode Luxury Branding**: Midnight Spectrum color palette
- **Zero-Cost Infrastructure**: Cloudflare Pages + R2 + Supabase (Free Tier)

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (Strict mode)
- **Styling**: Tailwind CSS v4 + Shadcn/UI
- **Database**: Supabase (PostgreSQL)
- **Storage**: Cloudflare R2 (S3 Compatible)
- **Hosting**: Cloudflare Pages
- **State Management**: nuqs (URL params) + React Hooks

## Getting Started

### Prerequisites

- Node.js 22+ (LTS recommended)
- npm or yarn
- Supabase account
- Cloudflare account (for R2 and Pages)

### Installation

```bash
# Clone the repository
git clone https://github.com/nebulamedads-lgtm/version_1.0.git

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Add your environment variables (see .env.example)
```

### Development

```bash
# Run development server
npm run dev

# Open http://localhost:3000
```

### Admin Dashboard

Access the admin dashboard at `/admin?key=YOUR_ADMIN_KEY`

**Important**: Content uploads (stories, gallery items) must be performed from localhost. Production uploads are currently disabled due to Edge runtime limitations (see Known Issues below).

## Known Issues & Limitations

### Production Upload Limitation

**Issue**: Production uploads via `/api/upload/proxy` encounter "DOMParser is not defined" errors in Cloudflare Edge runtime.

**Workaround**: All content uploads must be performed from localhost (`npm run dev`). The admin dashboard works correctly in local development.

**Root Cause**: AWS SDK v3 attempts to parse XML error responses using DOMParser, which is not available in Cloudflare Edge runtime.

**Status**: Deferred to future version. Potential solutions:
- Implement native R2 REST API upload (bypass AWS SDK)
- Migrate upload endpoints to Node.js runtime (if supported)
- Use direct client-side presigned URL uploads with proper CORS

**Impact**: Content management must be done locally. All other production features work correctly.

## Deployment

### Cloudflare Pages

1. Connect your GitHub repository to Cloudflare Pages
2. Set build command: `npm run build`
3. Set output directory: `.vercel/output/static`
4. Add environment variables in Cloudflare Pages dashboard

### Required Environment Variables

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Cloudflare R2
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_ENDPOINT= (or R2_ACCOUNT_ID)
R2_BUCKET_NAME=trans-image-directory
R2_STORIES_BUCKET_NAME=stories
NEXT_PUBLIC_R2_DOMAIN=
NEXT_PUBLIC_R2_STORIES_DOMAIN=

# Admin
ADMIN_KEY= (or ADMIN_SECRET_KEY)

# Optional
NEXT_PUBLIC_R2_PUBLIC_URL=
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   │   ├── admin/         # Admin endpoints
│   │   └── upload/        # Upload endpoints
│   ├── admin/             # Admin dashboard
│   └── model/[slug]/      # Model profile pages
├── components/
│   ├── features/          # Feature components (ModelCard, StoryViewer, etc.)
│   ├── layout/           # Layout components (Header, etc.)
│   └── ui/               # Shadcn/UI primitives
├── hooks/                 # Custom React hooks
├── lib/                   # Utilities (Supabase, R2, i18n)
└── types/                 # TypeScript type definitions
```

## Documentation

- [Project Log](./Project_Log.md) - Detailed implementation history
- [Version 1.1 Planning](./version_1,1.md) - Original project specification

## License

Private project - All rights reserved
