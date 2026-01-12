# Project Definition: TranSpot Directory (Version 1.1)

## 1. Executive Summary
A streamlined, high-performance landing page designed to convert traffic from X (Twitter) parody accounts into OnlyFans/Fansly subscribers. The platform prioritizes speed, trust, and ease of navigation, eliminating **friction** (like login screens) to maximize the "Call to Action" (click-throughs).

**Strategic Shift:** Version 1.0 adopts the "Vibe Coding" methodology, utilizing AI-native workflows (specifically Cursor) to accelerate development while ensuring the infrastructure—hosted on Cloudflare—remains zero-cost and resilient to viral traffic spikes.

---

## 2. Refined Core Functions

### 2.1 Main Interface (Home)
* **Dynamic Header Logic:** The main interface header now updates dynamically based on the user's IP geolocation (Cloudflare cf-ipcity) to display 'Models Near [City]'.
* **Fixed Navigation Bar:** A sticky top bar provides seamless switching between 'Near', 'New', and 'Favorites' feeds using URL-based state management (nuqs).
* **Model Feed:** A clean, responsive grid of "Cards" displaying the model's cover photo, name, and key tags.
* **Fake Proximity:** Clarified that no geospatial sorting occurs. The sorting algorithm remains 'Online Priority Shuffle'. The 'Near' label is a header-only cosmetic feature.
* **Pinned Models:** The first slots are reserved for specific high-priority models (manually flagged via Supabase).
* **Category Pills:** A horizontal scrollable list of clickable tags (e.g., "Blonde", "Latina", "Petite", "Goth") for instant client-side filtering.
* **Vibe Implementation:** URL-based state management (e.g., `?tag=blonde`) to ensure shareability and SEO.
* **Performance:** Optimized for mobile loading speed using Next.js Server Components.

### 2.2 Personal Interface (Profile View)
* **Model Details:**
    * **Auto-Bio:** Short personal description.
    * **Fixed Info:** Age, Tags, Ethnicity.
* **The "Money" Button:** A prominent "Chat with me" / "See Exclusive Content" button that redirects directly to the model's OnlyFans/Fansly.
* **Fake Online Status:** A visual indicator (Green Dot = Online, Gray Dot = Offline) next to the name.
    * *Logic:* A client-side `useEffect` hook randomly assigns status on mount (70% probability of "Online") to create urgency without causing server **hydration errors**.
* **Related Profiles:** A "You might also like" section at the bottom to keep the user exploring.

### 2.3 User Interaction (Simplified)
* **No-Login Favorites:** Users can "Heart" (favorite) models.
    * *Technical Implementation:* Uses Local Storage (browser cache) via a custom React hook. No account creation or database write is required.
* **No Comments/Social:** Removed to reduce moderation work and focus purely on the redirect.
* **Analytics:** Lightweight traffic tracking (Views/Clicks) with Geolocation.

### 2.4 (New Section: Engagement & Viral Mechanics)

* **Verified Badges:** Models can be manually flagged as is_verified in the database, rendering a blue checkmark to increase CTR.

* **Scarcity Engine:** A 'Locked Content' component renders at the bottom of the feed to simulate a location-based restriction on further content.

* **Deep Linking (Shareable URLs):**
    - **Story Links:** Every story maintains a `?story=UUID` parameter in the URL bar, enabling instant copy/paste sharing.
    - **Profile Links:** Profile pages include a Share button (mobile header) for native sharing or clipboard fallback.
    - **Benefit:** Users can share specific content without friction; links are SEO-friendly and bookmarkable.

* **Native Sharing (Viral Loop):**
    - Utilization of the Web Share API (`navigator.share`) on mobile devices to allow users to post models/stories directly to WhatsApp/Twitter/Instagram.
    - **Fallback:** Desktop users get clipboard copy with visual confirmation (checkmark icon).
    - **Hook:** Implemented via `useShare` hook with `isCopied` state for UI feedback.

* **Clipboard Conversion Flow ("Copy & Go"):**
    - **Problem:** Users click "Respond" on a story but forget which story they were replying to once they reach OnlyFans.
    - **Solution:** A hybrid button interaction that:
        1. Copies the deep link (`domain.com/?story=xyz`) to the clipboard *instantly*.
        2. Opens the OnlyFans/Fansly destination in a new tab *simultaneously*.
        3. Displays a "Link Copied!" micro-toast for 2 seconds as visual confirmation.
    - **Benefit:** Zero friction context sharing. User lands in DMs → Pastes → Model knows exactly which story prompted the message.
    - **Hook:** Implemented via `useShare` hook's `copyAndGo(deepLink, externalUrl)` function with `isCopiedAndGo` state.


---

## 3. Technical Architecture & Stack

### 3.1 Vibe Coding Environment
* **Primary IDE:** Cursor (Fork of VS Code).
* **Usage:** Leveraging "Composer" mode for multi-file generation and the "Shadow Workspace" for rapid iteration.
* **Context Strategy:** A strict `.cursorrules` file will be enforced to guide the AI, ensuring adherence to the tech stack and "mobile-first" design principles.

### 3.2 The "Zero-Cost" Stack
* **Frontend Framework:** Next.js (App Router).
    * *Reason:* High compatibility with AI coding tools and Shadcn/UI.
* **UI Library: Shadcn/UI (Tailwind v4 Optimized).
    * *Reason:* Allows the AI to own and modify the actual component code (copy-paste architecture) rather than fighting with a black-box library.
    * *Must utilize Tailwind CSS v4 'CSS-first' configuration (@theme directive in globals.css). Legacy tailwind.config.js patterns are strictly prohibited.
* **State Management (Global):** Nuqs (v2). Constraint: Requires <NuqsAdapter> wrapping the application in layout.tsx to function with Next.js 15 App Router.
* **Animation: Framer Motion (v12 Alpha). Constraint: Use alpha release to support React 19. Ensure 'use client' directive on all animated components.
* **Backend/Database:** Supabase (Free Tier).
    * *Role:* Relational database (Postgres) for model metadata (names, links, tags).
    * *Security:* Row Level Security (RLS) enabled for public read-only access.
* **Image Hosting:** Cloudflare R2 (Multi-Bucket).
    * *Reason:* Zero **Egress Fees**.
    * *Structure:* `trans-image-directory` for profile images, `stories` for story media.
* **Hosting & CDN:** Cloudflare Pages.
    * *Reason:* Unlimited static bandwidth and native integration with R2.

### 3.3 Data Management (The "No-Admin" Approach)
* **Input Method:** No custom admin panel will be built for V1.
* **Process:** New models are added manually via the Supabase Table Editor (spreadsheet-like interface).
* **Asset Workflow:** Images are pre-optimized (WebP, resized) locally using a vibe-coded Node.js script before being manually uploaded to the R2 bucket to ensure performance.
* **Update (V1.2):** A secret "Command Center" (`/admin`) was built to handle Story Uploads via R2 Presigned URLs, as manual DB entry for temporary media was too high-friction.

---

## 4. Development Roadmap (The Hybrid Intelligence Protocol)
This roadmap is adapted for an AI-assisted **20-hour sprint**:

* **[x] Phase 1: Constitution (Hours 0-2)**
    * [x] Setup `.cursorrules` defining the "Senior Next.js Developer" persona.
    * [x] Initialize Next.js repo with Tailwind and Shadcn/UI.
    * [x] Environment Prep: Installed Node.js LTS and configured Cursor CLI
    * [x] Create Supabase project and SQL schema (models, tags).

* **[x] Phase 2: The Component Factory (Hours 2-8)**
    * [x] Prompt Cursor: "Create a responsive ModelCard... using framer-motion (Client Component) and Tailwind v4 syntax."
    * [x] Prompt Cursor: "Build a StatusIndicator with a random online logic hook."
    * [x] Prompt Cursor: "Generate a sticky horizontal scroll container for CategoryPills using Tailwind v4 @utility for scrollbar hiding (no plugins)."
    * [x] Standardize UI Components (StatusIndicator, ModelCard, CategoryPills). 
    * [x] Implement "Scarcity Engine" (Locked content block). 
    * [x] Create "Fixed Header" with Geolocation integration (Models Near [City]).

* **[x] Phase 3: Data & Logic Integration (Hours 8-14)**
    * [x] **Database Migration:** Create `003_add_gallery_array.sql` to add `gallery_urls` (TEXT array) to the `models` table.
    * [x] **UI Implementation:** Replace static hero image in Profile View with `Shadcn Carousel`.
      - Logic: Map `gallery_urls`.
      - Feature: "End Card" logic (If index == last, show "See Explicit Content" CTA).
    * [x] Database Migration: Added `is_verified`, `is_new`, and `gallery_urls`. 
    * [x] UI Implementation: Profile View with Glassmorphism Header and Money Button. 
    * [x] Logic: "Online Priority Shuffle" implemented in FeedManager. 
    * [x] State Management: `nuqs` adapter and hooks installed and verified. 
    * [x] Connect Supabase client for server-side data fetching (Replacing Mock Data).

    * [x] Analytics: Implemented `useAnalytics` hook and `logEvent` Server Action. 
    * [x] Favorites: Implemented `useFavorites` with hydration safety.
    * [x] Implement `useFavorites` hook for Local Storage persistence. (Completed: Client-side hydration safe) 
    * [x] Wire up the "Money Button" to dynamic social links. (Completed: integrated into Profile View)
    * [x] Implement "Online Priority Shuffle": Logic to randomize online status and sort active models to the top on every refresh.

* **Phase 4: Asset Pipeline & Deployment** (Completed) 
   * [x] Configure `next.config.ts` for Cloudflare Edge Runtime (Next.js 15). 
   * [x] Deploy to Cloudflare Pages. 
   * [x] Implement R2 Storage with WebP optimization strategy. 
   * [x] **Core Gallery Fix:** URLs resolving and images displaying.

* **Phase 4.5: Stabilization & UX Polish (Current Focus)**
 *Immediate priority tasks to fix production anomalies.* 1. Gallery Mechanics (The "Magnetic" Feel)
   * [x] **Magnetic Snap:** Fixed "free scrolling" bug; images now snap perfectly to center.
   * [x] **Desktop Navigation:** Added Glassmorphism Left/Right arrows (Hidden on mobile). 

2. Desktop Layout Optimization (Completed)
   * [x] **Problem:** Profile images were too large/wide on desktop screens.
   * [x] **Solution:** Implemented "Split Screen" architecture.
  - Left Col: Sticky Bio & Chat Button (Always visible).
  - Right Col: Vertical Image Stack.
  - **Constraint:** `max-w-4xl` container to fit standard Laptop viewports (MacBook Air/Pro).


3. Functional Repairs 
- [x] **Favorites Icon:** Fixed hydration mismatch using `isMounted` state. 
- [x] **Geolocation:** Fixed `cf-ipcity` detection; now correctly displays "Models Near [City]". 
- [x] **Interaction Buttons:** Wired up "Chat with me" and "Unlock Content" buttons with `href` and `trackClick`. 

4. Dynamic Conversion Logic (Completed) - [x] **Logic:** - If `is_verified === true` -> Button text: "Chat with Me" (Localized) - If `is_verified === false` -> Button text: "Chat with [Name]" (Localized)

5. Internationalization (New Feature - Completed) 
- [x] **Language Detection:** Middleware identifies country code. 
- [x] **Interface Translation:** Navigation, Scarcity Block, and Buttons translate automatically. - [x] **Content Translation:** - Tags are mapped in `i18n.ts`. 
  - Models support `bio_es` for manual Spanish overrides.

### Phase 4.7: Stories Integration (Instagram Style)
**Goal:** Increase engagement/CTR by adding a "Stories" feature with decay logic (7-day auto-hide) and pinned groups.
**Status:** [x] Complete

- [x] **Database Schema (Supabase)**
    - [x] Create `story_groups` table (Fields: `id`, `model_id`, `title` (nullable for recent), `is_pinned`, `cover_url`).
    - [x] Create `stories` table (Fields: `id`, `group_id`, `media_url`, `media_type`, `duration`, `posted_date`).
    - [x] Enable RLS policies for Public Read access.

- [x] **Type Definitions (`src/types/index.ts`)**
    - [x] Define `Story` interface (media, duration, date).
    - [x] Define `StoryGroup` interface (title, pinned status, array of stories).
    - [x] Update `Model` interface to include optional `story_groups`.

- [x] **Layout Engine Upgrade (`src/app/model/[slug]/page.tsx`)**
    - [x] **Critical:** Update Grid to 3-Column Layout (Info | Gallery | Stories) for Desktop.
    - [x] **Critical:** Override `.cursorrules` max-width constraint to `max-w-7xl` or `max-w-full` for this specific page to fit the 3 columns without shrinking the gallery.
    - [x] Mobile: Ensure "Stories" block renders *above* the Gallery but *below* the Info.

- [x] **Core Components**
    - [x] `StoryCircle.tsx`: The trigger component with a gradient ring (Green for new, Gray for seen).
    - [x] `StoryViewer.tsx`: Full-screen modal overlay.
        - [x] Implements `nuqs` (URL state) to handle open/close state (e.g., `?story=open`).
        - [x] Logic: Auto-advance progress bar.
        - [x] Logic: "Tap to hold" (pause) and "Tap sides" (nav).
    - [x] `StoryUpload.tsx`: *Replaced by `/admin` dashboard.*

- [x] **Optimization & "Zero Cost" Logic**
    - [x] Implement "Soft Delete" Query: Modify the Supabase SELECT query to filter out stories where `created_at` > 7 days (unless `is_pinned` is true).
    - [x] Lazy Load: Ensure story media is ONLY fetched when the viewer is opened, not on page load.

### Phase 4.95: Main Feed Stories Integration (The "Instagram" Header)
**Goal:** Drive immediate engagement by placing recent stories at the top of the "Near" feed.
**Status:** [x] Complete

- [x] **Database Automation (Triggers)**
    - [x] Implemented `009_auto_update_story_timestamp.sql` to track `last_story_added_at`.
    - [x] Logic: Only "Recent" (Unpinned) story uploads trigger the timestamp update.
- [x] **UI Component (`HomeStoriesBar`)**
    - [x] Displays a horizontal scrollable list of models with active, unpinned stories.
    - [x] Location: Sticky below the header, visible only on the "Near" feed.
- [x] **Navigation Experience**
    - [x] **Inter-Model Swipe:** Users can tap "Next" on the last story of Model A to jump to Model B.
    - [x] **History Management:** Uses `replace` history mode to ensure the Android/iOS "Back" button closes the viewer instead of cycling previous stories.
    - [x] **Verified Integration:** Badges appear in the viewer header.

### Phase 4.96: Category Filtering & Story Animation Polish
**Goal:** Restore tag filtering with smart frequency sorting and add premium story transition animations.
**Status:** [x] Complete

- [x] **Category Pills Restoration**
    - [x] Implemented frequency-based tag sorting (top 15 most popular tags displayed).
    - [x] Created `FilterableFeed` client wrapper to manage filtering state.
    - [x] CategoryPills hidden on "Favorites" feed for cleaner UX.
    - [x] Selected pill styling: `bg-pink-500 text-white`; unselected: glassmorphism.

- [x] **Story Viewer Animation System**
    - [x] Added `animationType` state to differentiate story vs model transitions.
    - [x] **Tap Logic:** Story-first navigation (try next story, then next model).
    - [x] **Swipe Logic:** Model-first navigation (immediately jump to next/prev model).
    - [x] **Story Animation:** `fade-in zoom-in-95 duration-300` (subtle).
    - [x] **Model Animation:** `slide-in-from-right-full duration-500` (dramatic).

- [x] **Stories Container Navigation Isolation**
    - [x] Separated `pinnedGroups` and `feedGroups` for independent navigation.
    - [x] Neighbor calculation now scoped to same group type.
    - [x] Pinned stories navigate only to other pinned stories.

### Phase 4.97: Hybrid Video Support (Stories & Gallery)
**Goal:** Enable video content in both Stories and Profile Gallery with optimized playback.
**Status:** [x] Complete

- [x] **Story Hybrid Video**
    - [x] Admin Dashboard "Video Mode" with 3 file inputs (MP4, WebM, Poster).
    - [x] Single timestamp batch uploads with explicit Content-Type headers.
    - [x] Story Viewer dual `<source>` rendering (WebM priority, MP4 fallback).
    - [x] Fixed poster image display and chronological playback order.

- [x] **Gallery Architecture Migration**
    - [x] Created `gallery_items` table replacing `gallery_urls` array.
    - [x] Added `GalleryItem` interface with `media_type`, `poster_url`, `sort_order`.
    - [x] Created `/api/admin/gallery` route for item insertions.
    - [x] Migration script for existing gallery data.

- [x] **ProfileGallery Video Player**
    - [x] Refactored to accept `GalleryItem[]` instead of `string[]`.
    - [x] Intersection Observer for visibility-based playback.
    - [x] Auto-play when 50% visible, pause/reset when hidden.
    - [x] Loop infinitely, muted, no controls (TikTok/Instagram UX).
    - [x] Fallback chain: `gallery_items` → `image_url` (legacy `gallery_urls` removed in migration 012).

- [x] **Locked VIP Teaser (Conversion Optimization)**
    - [x] Last gallery item transformed into locked conversion card (removed separate end-card).
    - [x] Blurred preview with gradient overlay and lock icon.
    - [x] "Want to see more?" CTA with redirect to model's social link.
    - [x] Optimized blur levels: Images (11px/19px), Videos (19px/13px).
    - [x] Click tracking and analytics integration.

- [x] **Admin Dashboard Gallery Manager**
    - [x] Added "Gallery Manager" tab for video/image uploads.
    - [x] Toggle between Image Mode and Video Mode.
    - [x] Video uploads: MP4 + WebM + Poster (all required).

* **[x] Phase 5: Aesthetic Rebranding (Dark Mode Luxury)**
- [x] **Color Palette:** Implemented "Midnight Spectrum" (Obsidian Navy, Electric Emerald, Rich Gold, Cyber Violet).
- [x] **Typography:** Editorial/Tech Hybrid (Playfair Display for headlines, Montserrat for body).
- [x] **Component Refactoring:** Updated all components to use new luxury palette and glassmorphism effects.
- [x] **Story Viewer:** Fixed blur effect using React Portal architecture for Instagram-style frosted glass.
- [x] **Custom Utilities:** Added `.glass-panel`, `.gold-glow`, `.emerald-button` utility classes.

* **[x] Phase 5.1: Visual Memory Feature**
- [x] **useViewedModels Hook:** Created hydration-safe localStorage hook to track viewed profiles.
- [x] **ModelCard Visual Memory:** 
  - Unviewed: 80% grayscale + 86% opacity vignette overlay
  - Viewed: Full color (grayscale-0) + no vignette
  - Smooth 500ms transitions on hover
- [x] **UX Impact:** Users can visually distinguish explored vs. new profiles without authentication.

* **[x] Phase 5.2: Story Visual Memory & Real-Time Sync**
- [x] **useViewedStories Hook:** Created hydration-safe localStorage hook to track viewed story groups.
- [x] **StoryCircle Visual Memory:**
  - Unviewed: Electric Emerald → Gold → Violet gradient ring
  - Viewed: Gray ring (muted)
  - 300ms transition for smooth feedback
- [x] **Instagram-Style Story Sorting:**
  - Unviewed stories appear first (left side)
  - Viewed stories automatically move to end
  - Within each group, newest first
- [x] **Real-Time Synchronization:**
  - Both `useFavorites` and `useViewedStories` support cross-component sync
  - Custom events for same-window updates
  - Storage events for cross-tab/window sync
  - Favorites and stories update instantly without page reload

* **[x] Phase 5.3: Category Pills Glassmorphism Refinement**
- [x] **Floating Glass Pills:** Refactored to individual floating glassmorphism elements (no background bar)
- [x] **iOS 26 Glass Container:** Added subtle glass border container with extremely minimal blur and visible border
- [x] **Border Removal:** Removed borders from inactive pills to match ChatButton aesthetic
- [x] **Text Shadow:** Added subtle dark text shadow for white text readability on bright backgrounds
- [x] **Transparency:** Made all containers fully transparent to eliminate visible lines
- [x] **HomeStoriesBar:** Removed background bar for fully transparent stories container
- [x] **Horizontal Extension:** Extended container slightly beyond content area to make borders visible

* **[x] Phase 5.9: Story Progress Bar Visibility Fix**
- [x] **Main Layout:** Progress bars always visible, even for single-story blocks (provides visual feedback and consistency)
- [x] **Model Profile:** Progress bars hidden for single-story blocks, visible only when multiple stories exist (reduces UI clutter)
- [x] **Implementation:** Conditional rendering based on `disableLongPress` prop and story count
- [x] **Condition:** `(!disableLongPress || stories.length > 1)` ensures main layout always shows bars, model profile shows only for multiple stories

---

## 5. Exclusions (Not in V1)
* **User Login/Auth:** Deemed unnecessary friction.
* **Comments/Likes on Content:** Removed to save database costs.
* **Random/Roulette Button:** Excluded by request.
* **Content Uploading:** Models cannot upload their own content; managed centrally by the CEO *via Secret Dashboard*.
* **History Injection (Deep Link Back Button):** Attempted feature to manipulate browser history so "Back" button navigates to home feed instead of closing the tab when landing on a deep link. Deferred due to conflicts with Next.js App Router's internal history management. Hook exists in codebase (`use-landing-history.ts`) for future implementation.


