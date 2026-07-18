# BuildWise AI — Enhanced PRD v2.0
### Premium UI/UX Design System + Complete API Specification (Agentic-AI Ready)

---

## PART A — Premium UI/UX Design System

### A.1 Design Philosophy
- Feel like a **premium tech marketplace** (Apple Store x Vercel x Linear vibe) — না যেন সাধারণ bootstrap e-commerce মনে হয়।
- **Dark-first** design (tech/gaming audience), সাথে Light mode toggle।
- Depth তৈরি হবে shadow, blur, gradient দিয়ে — flat/boring card লেআউট এড়িয়ে চলতে হবে।
- Motion subtle কিন্তু purposeful (hover, page transition, skeleton → content fade-in)।
- প্রতিটা component-এ consistent radius, spacing, elevation থাকবে — কোনো ad-hoc styling না।

### A.2 Color System

**Base palette (Tailwind CSS variables হিসেবে define করতে হবে — `globals.css` এ CSS vars + `tailwind.config.ts` এ map করা)**

| Token | Light Mode | Dark Mode | ব্যবহার |
|---|---|---|---|
| `--color-primary` | `#2563EB` | `#3B82F6` | CTA buttons, links, active states |
| `--color-primary-hover` | `#1D4ED8` | `#60A5FA` | hover states |
| `--color-secondary` | `#0F172A` | `#0B0F19` | headers, hero background, nav |
| `--color-accent` | `#F59E0B` | `#FBBF24` | badges, highlights, "AI" tags |
| `--color-bg` | `#F8FAFC` | `#0B0F19` | page background |
| `--color-surface` | `#FFFFFF` | `#111827` | card/panel background |
| `--color-surface-2` | `#F1F5F9` | `#1A2233` | nested surfaces, input fields |
| `--color-border` | `#E2E8F0` | `#1F2937` | dividers, card borders |
| `--color-text-primary` | `#0F172A` | `#F1F5F9` | headings |
| `--color-text-secondary` | `#475569` | `#94A3B8` | body/subtext |
| `--color-success` | `#16A34A` | `#22C55E` | compatibility OK, in stock |
| `--color-warning` | `#F59E0B` | `#FBBF24` | partial compatibility |
| `--color-error` | `#DC2626` | `#EF4444` | incompatible, out of stock |

**Premium gradient tokens (accent elements-এ ব্যবহার হবে — hero, AI চ্যাট bubble, CTA button background):**
- `--gradient-primary: linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)`
- `--gradient-accent: linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)`
- `--gradient-mesh` (hero background): radial gradient blobs — blue + purple + subtle noise texture, opacity 10-20%

> Rule: max 3 core colors (primary/secondary/accent) — PRD v1-এর নিয়ম বজায় থাকবে, gradient শুধু accent হিসেবে ব্যবহার হবে, overuse না।

### A.3 Typography
- **Heading font:** `Geist` অথবা `Inter` (Google Fonts / Vercel font) — weight 600–800
- **Body font:** `Inter` — weight 400–500
- **Mono font (specs/prices/SKUs):** `JetBrains Mono` অথবা `Geist Mono`

| Style | Size (desktop) | Size (mobile) | Weight | Line-height |
|---|---|---|---|---|
| H1 (Hero) | 56px | 32px | 800 | 1.1 |
| H2 (Section) | 36px | 26px | 700 | 1.2 |
| H3 (Card title) | 20px | 18px | 600 | 1.3 |
| Body | 16px | 15px | 400 | 1.6 |
| Small/Caption | 13px | 12px | 500 | 1.4 |
| Price | 22px | 20px | 700 (mono) | 1 |

### A.4 Spacing, Radius & Elevation
- Spacing scale: Tailwind default `4px` base (`p-1`…`p-24`), page padding: `px-4 md:px-8 lg:px-16`
- Border radius: `rounded-xl` (12px) for cards, `rounded-full` for buttons/badges/avatars, `rounded-2xl` (16px) for modals/hero panels
- Shadow scale (custom, premium/soft — না harsh):
  - `shadow-soft`: `0 2px 8px rgba(15,23,42,0.06)`
  - `shadow-elevated`: `0 8px 24px rgba(15,23,42,0.10)`
  - `shadow-glow-primary` (hover on CTA): `0 0 24px rgba(37,99,235,0.35)`

### A.5 Core Components (spec for AI agent to implement)

**1. Navbar**
- Sticky, `backdrop-blur-md` + semi-transparent background (glassmorphism) on scroll
- Logo (left) → Nav links (center, desktop only) → Search bar (expandable) + Cart/Wishlist icon + Auth avatar/menu (right)
- Mobile: hamburger → slide-in drawer with blur overlay

**2. Product Card**
- Image (aspect-ratio 1:1, `object-cover`, lazy-loaded, skeleton while loading)
- Category badge (top-left, small pill, accent color)
- Title (2-line clamp) + Brand (secondary text)
- Rating stars + review count (small row)
- Price (mono font, bold) + optional strikethrough original price
- Stock status dot (green/red)
- Hover: `translateY(-4px)` + `shadow-elevated` transition (200ms ease)
- "Add to Build" / "View Details" buttons appear on hover (desktop) or always visible (mobile)

**3. AI Build Result Card (premium — distinguishes this from a normal shop)**
- Gradient border (`gradient-primary`, 1px, via `background-clip`)
- "✨ AI Recommended" badge at top with accent gradient background
- Component list — each row: icon + component name + 1-line AI reasoning (collapsible "why this?" accordion)
- Total price summary footer (sticky at bottom of card on mobile)
- "Save Build" primary button + "Regenerate" ghost button

**4. Compatibility Checker Panel**
- Split view: left = selected components list (drag to reorder/remove), right = AI analysis panel
- Compatibility status per pair shown as colored connector lines/icons (✅ / ⚠️ / ❌) between component nodes
- Issues listed as expandable cards with suggested alternative product cards inline

**5. AI Chat Assistant (floating widget + full page mode)**
- Floating button (bottom-right, gradient circle, pulsing glow when idle to invite interaction)
- Chat panel: user bubble (right, primary color) vs AI bubble (left, surface color, subtle gradient left border)
- Typing indicator: animated 3-dot pulse
- Suggested prompt chips above input (horizontal scroll)
- Streaming text render (token-by-token) for AI responses

**6. Buttons**
- Primary: gradient or solid `--color-primary` bg, white text, `rounded-full`, `px-6 py-3`, `shadow-soft` → `shadow-glow-primary` on hover
- Secondary: `border` + transparent bg, fills on hover
- Ghost: text-only, underline on hover
- Loading state: spinner replaces label, button disabled

**7. Forms/Inputs**
- Floating label or top label, `rounded-lg`, `border` default → `border-primary` + subtle ring on focus
- Inline validation messages (error text red, small, below field)

**8. Skeleton Loaders**
- Shimmer animation (`animate-pulse` + gradient sweep) matching exact shape of final content (card skeleton, text-line skeleton)

**9. Toasts**
- Top-right, slide-in, auto-dismiss 4s, color-coded left border (success/error/warning/info), icon + message + close button

**10. Dashboard Layout**
- Left sidebar (collapsible on tablet, drawer on mobile): Profile, Saved Builds, Favorites, AI History, (Admin: Manage Products/Users)
- Top stat cards (Recharts sparkline mini-charts) for admin dashboard — total products, users, revenue estimate, AI usage count

### A.6 Motion & Micro-interactions
- Library: **Framer Motion**
- Page transition: fade + slight upward translate (`opacity 0→1`, `y: 12→0`, 250ms)
- Scroll-reveal for landing page sections (`whileInView`)
- Number counters animate on stat cards (e.g., "10,000+ builds generated")
- Button press: scale `0.97` on tap

### A.7 Responsive Breakpoints (Tailwind default — explicitly confirm in config)
| Breakpoint | Width | Layout notes |
|---|---|---|
| `sm` | 640px | 1-column product grid |
| `md` | 768px | 2-column grid, sidebar becomes drawer |
| `lg` | 1024px | 3-column grid, sidebar visible |
| `xl` | 1280px | 4-column grid, max content width `1440px` centered |

### A.8 Iconography & Imagery
- Icons: `lucide-react` only (consistent stroke width `1.75`)
- Product images: white/neutral background, consistent aspect ratio, WebP with fallback
- Empty states: custom simple illustration (not stock photo) + short helper text + CTA

---

## PART B — Complete REST API Specification

**Base URL:** `/api/v1`
**Auth:** Bearer JWT (via Better Auth session cookie or `Authorization: Bearer <token>`)
**Response envelope (all endpoints):**
```json
{
  "success": true,
  "data": {},
  "message": "string",
  "error": null
}
```
Error response:
```json
{ "success": false, "data": null, "message": "Human readable error", "error": { "code": "STRING_CODE", "details": "..." } }
```

### B.1 Auth Module — `/api/v1/auth`
| Method | Endpoint | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/auth/register` | ❌ | `{ name, email, password }` | `{ user, token }` |
| POST | `/auth/login` | ❌ | `{ email, password }` | `{ user, token }` |
| POST | `/auth/google` | ❌ | `{ idToken }` | `{ user, token }` |
| POST | `/auth/logout` | ✅ | — | `{ success: true }` |
| GET | `/auth/me` | ✅ | — | `{ user }` |
| POST | `/auth/refresh` | ✅ (refresh token) | — | `{ token }` |

`user` object: `{ id, name, email, avatar, role: "guest"|"user"|"admin", createdAt }`

### B.2 Products Module — `/api/v1/products`
| Method | Endpoint | Auth | Query/Body | Response |
|---|---|---|---|---|
| GET | `/products` | ❌ | query: `page, limit, category, brand, minPrice, maxPrice, search, sort(price_asc\|price_desc\|rating\|newest)` | `{ products[], total, page, totalPages }` |
| GET | `/products/:id` | ❌ | — | `{ product }` |
| POST | `/products` | ✅ admin | `{ name, brand, category, price, description, images[], specifications{}, stock }` | `{ product }` |
| PUT | `/products/:id` | ✅ admin | partial product fields | `{ product }` |
| DELETE | `/products/:id` | ✅ admin | — | `{ success: true }` |
| GET | `/products/categories` | ❌ | — | `{ categories[] }` |

`product` object:
```json
{
  "id": "string",
  "name": "string",
  "brand": "string",
  "category": "CPU|GPU|Motherboard|RAM|SSD|HDD|PSU|Case|Cooler",
  "price": 0,
  "description": "string",
  "images": ["url"],
  "specifications": { "socket": "AM5", "wattage": 750 },
  "rating": 4.5,
  "reviewCount": 12,
  "stock": 20,
  "createdAt": "ISODate"
}
```

### B.3 Reviews Module — `/api/v1/reviews`
| Method | Endpoint | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/products/:productId/reviews` | ❌ | query: `page, limit` | `{ reviews[], averageRating, total }` |
| POST | `/products/:productId/reviews` | ✅ user | `{ rating (1-5), comment }` | `{ review }` |
| DELETE | `/reviews/:id` | ✅ owner/admin | — | `{ success: true }` |

### B.4 Favorites/Wishlist — `/api/v1/favorites`
| Method | Endpoint | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/favorites` | ✅ user | — | `{ products[] }` |
| POST | `/favorites/:productId` | ✅ user | — | `{ success: true }` |
| DELETE | `/favorites/:productId` | ✅ user | — | `{ success: true }` |

### B.5 PC Builds Module — `/api/v1/builds`
| Method | Endpoint | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/builds` | ✅ user | `{ name, components: [{ productId, category }], totalPrice, aiRecommendation? }` | `{ build }` |
| GET | `/builds` | ✅ user | query: `page, limit` | `{ builds[], total }` |
| GET | `/builds/:id` | ✅ owner/admin | — | `{ build }` |
| PUT | `/builds/:id` | ✅ owner | partial fields | `{ build }` |
| DELETE | `/builds/:id` | ✅ owner | — | `{ success: true }` |

### B.6 AI Module — `/api/v1/ai`
| Method | Endpoint | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/ai/generate-build` | ✅ user (guest: limited/rate-limited) | `{ budget, purpose: "gaming"\|"programming"\|"editing"\|"office", preferredBrand? }` | `{ build: { components[], totalPrice, reasoning{} }, conversationId }` |
| POST | `/ai/check-compatibility` | ✅ user | `{ components: [{ productId, category }] }` | `{ compatible: boolean, issues: [{ componentA, componentB, issue, suggestion, alternativeProductIds[] }] }` |
| POST | `/ai/chat` | ✅ user (guest: limited) | `{ message, conversationId? }` | `{ reply, conversationId, suggestedPrompts[] }` (stream via SSE optional) |
| GET | `/ai/conversations` | ✅ user | — | `{ conversations[] }` |
| GET | `/ai/conversations/:id` | ✅ owner | — | `{ messages[] }` |
| DELETE | `/ai/conversations/:id` | ✅ owner | — | `{ success: true }` |

**AI Build Generator — internal logic contract (for backend agent):**
1. Validate budget > 0, purpose in enum.
2. Query MongoDB products filtered by category + price range weighted by purpose (e.g. gaming → GPU gets ~35-40% of budget).
3. Call Gemini API with structured prompt → force JSON output (component picks + 1-2 line reasoning per part).
4. Validate AI's picked `productId`s actually exist & are in stock before returning — never trust raw AI output blindly.
5. Return combined result; save to `AI Conversations` collection.

### B.7 Admin Module — `/api/v1/admin`
| Method | Endpoint | Auth | Body/Query | Response |
|---|---|---|---|---|
| GET | `/admin/stats` | ✅ admin | — | `{ totalUsers, totalProducts, totalBuilds, totalAIRequests, revenueEstimate }` |
| GET | `/admin/users` | ✅ admin | query: `page, limit, search` | `{ users[], total }` |
| PUT | `/admin/users/:id/role` | ✅ admin | `{ role }` | `{ user }` |
| DELETE | `/admin/users/:id` | ✅ admin | — | `{ success: true }` |

### B.8 Standard Error Codes
| Code | Meaning |
|---|---|
| `UNAUTHORIZED` | missing/invalid token |
| `FORBIDDEN` | role not permitted |
| `NOT_FOUND` | resource missing |
| `VALIDATION_ERROR` | invalid request body |
| `RATE_LIMITED` | guest AI usage limit hit |
| `AI_ERROR` | Gemini API failure |
| `SERVER_ERROR` | unhandled exception |

### B.9 Rate Limiting (important for AI routes)
- Guest users: **5 AI requests/day** per IP (build generator + chat combined)
- Registered users: **50 AI requests/day**
- Implement via middleware (e.g. `express-rate-limit` + Mongo/Redis counter keyed by user/IP)

---

## PART C — Setup Info for the AI Coding Agent

### C.1 Environment Variables (`.env`)
```
# Database
MONGODB_URI=

# Auth
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# AI
GEMINI_API_KEY=

# App
NEXT_PUBLIC_API_BASE_URL=
JWT_SECRET=
NODE_ENV=development
```

### C.2 Suggested Folder Structure
```
buildwise-ai/
├── apps/
│   ├── web/               # Next.js frontend
│   │   ├── app/
│   │   ├── components/
│   │   │   ├── ui/        # buttons, cards, inputs (design system)
│   │   │   ├── products/
│   │   │   ├── builds/
│   │   │   └── ai/
│   │   ├── lib/
│   │   └── styles/globals.css
│   └── api/                # Express backend
│       ├── src/
│       │   ├── routes/
│       │   ├── controllers/
│       │   ├── models/
│       │   ├── middleware/
│       │   ├── services/ai/
│       │   └── server.ts
```

### C.3 Build Order Recommendation (for the agent to follow)
1. DB models (Users, Products, Categories, Builds, Reviews, AI Conversations)
2. Auth module (register/login/google/session)
3. Products CRUD + filtering/search
4. Design system components (Part A) as a shared UI kit first
5. Reviews + Favorites
6. PC Builds CRUD
7. AI module (build generator → compatibility checker → chat assistant)
8. Admin dashboard + stats
9. Polish: animations, skeletons, empty states, responsive QA

---
