# iCraftStories - Feature Catalog

Complete catalog of implemented features in the iCraftStories platform.

**Last Updated**: November 2025

## 🏠 Core Story Creation & Management

### AI-Powered Story Generation
- **Story Creation Wizard**: Step-by-step guided story creation process
- **AI Text Generation**: GPT-4 powered story writing with custom prompts
- **AI Image Generation**: Stability AI illustrations with consistent character design
- **Character-Based Stories**: Generate stories featuring user-defined characters
- **Social Skills Integration**: Create educational stories focused on specific social skills
- **Multi-Language Support**: English and Spanish story generation
- **Customizable Length**: Control story length (1-12 pages)
- **Style Consistency**: Maintain character appearance across all pages

### Story Editor
- **Interactive Canvas Editor**: Konva.js-powered visual story editing
- **Text Editor**: Rich text editing for story content
- **Image Placement**: Drag-and-drop image positioning on pages
- **Canvas State Management**: Save custom visual layouts and elements
- **Cover Page Design**: Custom cover creation with title and styling
- **Page Controls**: Add, remove, and reorder story pages
- **Auto-Save**: Automatic saving of story progress
- **Unsaved Changes Detection**: Alerts for unsaved work

### Content Enhancement
- **Image Regeneration**: AI-powered image improvement with user feedback
- **Cover Image Regeneration**: Redesign story covers with custom prompts
- **Page Image Regeneration**: Regenerate individual page illustrations
- **Custom Image Upload**: Upload and use personal images in stories
- **Image Optimization**: Automatic image processing and cloud storage
- **Audio Generation**: Text-to-speech narration using ElevenLabs
- **PDF Export**: Export stories as downloadable PDF files

### Image Library & Search
- **Curated Custom Image Library**: Access professionally curated image collection (1,196+ images)
- **Pixabay Integration**: Search millions of free stock photos from the web
- **Multi-Source Image Search**: Unified search across custom and web libraries
- **AI-Powered Semantic Search**: BGE-M3 embeddings for multilingual semantic search (100+ languages)
- **Vector Similarity Search**: Find images by meaning, not just keywords (pgvector with IVFFlat indexes)
- **Image Categorization**: Browse images by 20+ categories with bilingual support (EN/ES)
- **Search & Filter**: Find images by keywords, tags, and semantic similarity
- **Fallback Systems**: Graceful degradation to text search when embeddings unavailable
- **Image Proxy Service**: Secure API-based image fetching with rate limiting (100 req/60s)
- **Real-Time Query Embeddings**: Instant semantic search via Cloudflare Workers AI (@cf/baai/bge-m3)
- **Client-Side Caching**: IndexedDB + localStorage with 24-hour TTL for offline access
- **CDN Delivery**: All images served via Cloudflare CDN (img.icraftstories.com)

## 📚 Story Library & Organization

### Personal Library
- **Story Management**: View, edit, and organize personal stories
- **Search & Filter**: Find stories by title, tags, or content
- **Tag Management**: Organize stories with custom tags
- **Story Sharing**: Share stories with community or specific users
- **Story Duplication**: Clone existing stories for variations
- **Story Deletion**: Remove unwanted stories with confirmation
- **Progress Tracking**: Monitor story completion status
- **Recent Activity**: View recently edited stories

### Community Library
- **Story Discovery**: Browse publicly shared community stories
- **Story Copying**: Clone community stories to personal library
- **Community Search**: Find stories by tags, titles, and filters
- **Pagination**: Navigate through large collections efficiently
- **Story Previews**: Preview community stories before copying
- **Categorization**: Browse stories by educational topics and themes

## 👥 Team Collaboration

### Team Management
- **Team Creation**: Create and manage collaborative teams
- **Member Invitations**: Invite users via email with role assignment
- **Role-Based Access**: Owner, admin, and member permission levels
- **Team Directory**: View and manage team membership
- **Invitation Management**: Accept, decline, or cancel invitations
- **Team Stories**: Collaborate on shared story projects
- **Permission Control**: Role-based access to team features

### Team Coordination
- **Shared Credit Pools**: Team-wide credit sharing and management
- **Automatic Credit Transfer**: All personal credits automatically transfer to team on join
- **Automatic Story Transfer**: All personal stories become team-owned on invitation acceptance
- **Story Transfer Audit Trail**: Complete transaction history in `story_transfers` table
- **One-Team-Per-User Enforcement**: Database-enforced constraint with pre-flight validation
- **Team Activity Tracking**: Monitor collaborative activities with detailed audit logs
- **Email Notifications**: Automatic invitation and status updates
- **Team Story Management**: Shared story creation and editing rights
- **Subscription Upgrade Transfer**: Automatic transfer when upgrading individual → team/custom plan

## 💳 Subscription & Payment System

### Subscription Plans

| Plan | Credits | Team Size | Billing | Use Case |
|------|---------|-----------|---------|----------|
| **Trial** | 15 one-time | 1 | Free | New user exploration |
| **Individual** | 100/month | 1 | Monthly/Annual | Personal use |
| **Team** | 500/month | 5 | Monthly/Annual | Small teams |
| **Custom 30** | 2,000/month | 30 | Monthly/Annual | Organizations |

- **Credit Allocations**: Monthly credits based on plan tier
- **Trial Period**: 15 credits for new users to explore platform
- **Billing Options**: Monthly and annual subscription cycles
- **Plan Upgrades**: Seamless tier changes with prorated billing
- **Payment Processing**: Secure Stripe-powered transactions
- **Custom Plans**: Contact sales for larger organizations (custom_* plans)

### Credit Management
- **Credit Purchases**: Buy additional credit packages via Stripe
- **Usage Tracking**: Monitor credit consumption and balance in real-time
- **Credit History**: View detailed usage and purchase history (ledger model)
- **Team Credit Pools**: Shared credits for team members
- **Auto-Detection**: System automatically determines team vs. personal credits
- **Automatic Transfer**: Personal credits transfer to team on join

### Billing & Payments
- **Customer Portal**: Self-service subscription management
- **Payment Methods**: Multiple payment option support
- **Invoice Management**: Automated billing and receipts
- **Refund Processing**: Handle payment adjustments
- **Secure Checkout**: Industry-standard payment security

## 🌐 Progressive Web App (PWA) Features

### Mobile & Desktop Experience
- **App Installation**: Install as native app on devices (VitePWA with all icon sizes)
- **Offline Functionality**: Create and edit stories without internet
- **Cross-Platform**: Works on iOS, Android, Windows, macOS (iOS-specific optimizations)
- **Responsive Design**: Mobile-first Tailwind CSS with all breakpoints
- **Touch Gestures**: Swipe navigation with configurable threshold (useSwipeGesture hook)

**Not Implemented**:
- App Shortcuts: Quick actions from home screen (manifest shortcuts not configured)

### Offline Capabilities
- **IndexedDB Storage**: Local story storage with v19 schema (stories, activities, syncMetadata, deviceMetadata)
- **Offline Editing**: Full story editing without connection (AI generation requires network)
- **Background Sync**: HTTP polling every 5 minutes with immediate sync on reconnection
- **Conflict Resolution**: Last-write-wins with local-priority protection
- **Cache Management**: Multi-strategy caching (NetworkFirst for HTML/images, CacheFirst for fonts)
- **Connection Monitoring**: Dual-layer detection (navigator.onLine + fetch test) with persistent indicator

### Sync & Multi-Device
- **Background Sync**: Automatic synchronization when online
- **Device Management**: Track and manage connected devices
- **Last-Write-Wins**: Conflict resolution for simultaneous edits
- **Audit Trail**: Complete activity logging across devices
- **Sync Status**: Visual indicators for sync progress
- **Error Recovery**: Robust handling of sync failures

## 🎨 User Interface & Experience

### Personalization
- **Language Selection**: English and Spanish interface support
- **Theme Customization**: Personal preference settings
- **User Profiles**: Comprehensive user account management
- **Activity Dashboard**: Personal usage statistics and history
- **Preference Storage**: Persistent user customization settings

### Navigation & Accessibility
- **Intuitive Navigation**: Clean, user-friendly interface design
- **Skip to Content**: Accessibility navigation shortcuts
- **Keyboard Support**: Full keyboard navigation capability
- **Screen Reader Support**: ARIA labels and semantic HTML
- **Error Boundaries**: Graceful error handling and recovery
- **Loading States**: Clear feedback during operations

### Notifications & Feedback
- **Unified Notifications**: Consistent error and success messaging
- **Toast Messages**: Non-intrusive status updates
- **Progress Indicators**: Visual feedback for long operations
- **Confirmation Dialogs**: Prevent accidental actions
- **Help & FAQ**: Comprehensive user guidance

## 🔧 Administrative Features

### Terms of Service Management
- **Version Control**: Managed TOS versions with effective dates
- **User Acceptance Tracking**: Complete audit trail of user acceptances
- **Bilingual Support**: English and Spanish TOS content
- **Team Integration**: TOS acceptance required during team invitation flow
- **Compliance Ready**: Timestamped acceptances with user metadata

### Content Moderation
- **Community Moderation**: Moderators can delete community stories
- **Content Filtering**: Prompt sanitization and AI service content policies (Stability AI 403 handling)
- **Activity Logging**: Complete activity trail in database for audit compliance

### Partial/Planned Features
- **Story Approval Workflow**: Database field exists (`is_approved`), but approval UI not implemented - stories auto-approved on sharing
- **User Management Dashboard**: Admin route guard exists, but full dashboard not implemented
- **Analytics Dashboard**: Activity data logged, but user-facing dashboard not implemented

## 📱 Technical Capabilities

### Integration Features
- **Clerk Authentication**: Modern, secure user authentication
- **Stripe Integration**: Professional payment processing
- **AI Service Integration**: OpenAI, Stability AI, ElevenLabs
- **Cloud Storage**: Cloudflare R2 for media assets
- **Real-Time Updates**: Live collaboration and notifications

### Security & Privacy
- **JWT Authentication**: Secure token-based authentication
- **Role-Based Permissions**: Granular access control
- **Data Encryption**: Secure data transmission and storage
- **Privacy Controls**: User data protection and GDPR compliance
- **Audit Trails**: Complete activity logging for security

## 🚀 Platform Highlights

### Core Value Propositions
- **AI-Powered Creativity**: Automated story and image generation
- **Educational Focus**: Social skills and therapeutic storytelling
- **Team Collaboration**: Multi-user story creation and sharing
- **Offline-First**: Full functionality without internet connection
- **Cross-Platform**: Native app experience on all devices
- **Professional Grade**: Enterprise-ready with robust infrastructure

### Target Use Cases
- **Educators**: Create personalized learning materials
- **Therapists**: Develop social skills training stories
- **Parents**: Build custom stories for children
- **Teams**: Collaborate on educational content
- **Organizations**: Scale story creation across departments

---

## Implementation Notes

### Fully Implemented
- **AI Story Generation**: GPT-4o-mini text + Stability AI SD3.5-large-turbo images
- **Subscription Plans**: Trial (15), Individual (100/mo), Team (500/mo), Custom 30 (2,000/mo)
- **Credit System**: Pure ledger model with database-first team attribution
- **PWA/Offline**: 92% feature complete (11/12 features) - production-grade
- **Sync Model**: HTTP polling with last-write-wins conflict resolution
- **Image Search**: BGE-M3 semantic search with pgvector

### Partial Implementation
- **Admin Features**: Basic moderation (delete stories), but no approval workflow or dashboard
- **Content Filtering**: Passive only (prompt sanitization, AI service rejections)

### Architecture Decisions
- **Story Ownership**: Immutable after creation (no transfer between personal/team)
- **Authentication**: Clerk JWT at API level (not database RLS)
- **Sync Strategy**: HTTP polling instead of Background Sync API (iOS compatibility)

For future enhancements and optimizations, see [`STRATEGIC_ENHANCEMENTS.md`](./STRATEGIC_ENHANCEMENTS.md).

---

*Feature catalog based on codebase analysis - Last updated: November 2025*