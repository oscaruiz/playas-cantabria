# Beach Discovery and Trust Improvements

## Goal

Improve beach discovery, repeat usage, search visibility and data transparency
without weakening the application's main purpose: helping users decide which
Cantabrian beach is the best option today.

## Working branch

feature/beach-discovery

## Constraints

- Preserve the current Ionic navigation architecture.
- Do not migrate the application to another framework.
- Keep Android/Capacitor compatibility.
- Avoid changing the existing ranking algorithm unless explicitly required.
- Do not present static beach attributes as live information.
- Every live or time-sensitive value must expose its source and update time.
- All user-facing text must use the existing translation system.
- Add tests for new domain logic.
- Run lint, tests and production build after every phase.
- Make one commit per completed phase.

## Current routes

- /
- /playas
- /playas/:codigo
- /mapa

## Delivery phases

### Phase 0: Baseline and architecture audit

Objectives:

- Document the current routing, data flow and build process.
- Identify which beach fields are live, forecast, static or user-derived.
- Identify existing reusable fields for services and beach characteristics.
- Establish a baseline for tests, lint and build.
- Recommend the safest prerendering strategy compatible with CRA, Ionic,
  React Router 5, Firebase Hosting and Capacitor.

Deliverables:

- tasks/beach-discovery/00-audit.md
- Data classification table.
- Proposed URL and metadata strategy.
- No production behavior changes.

Acceptance criteria:

- npm test passes.
- npm run lint passes.
- npm run build passes.
- Audit identifies risks before implementation begins.

### Phase 1: Data provenance and freshness

Objectives:

- Create a reusable source/freshness presentation model.
- Distinguish:
  - live observations
  - forecasts
  - static beach information
  - unavailable information
- Show the source and relevant timestamp close to each important value.
- Make stale or fallback data visible without alarming the user.
- Never use a generic global update time when individual sources have
  different timestamps.

Suggested components:

- DataSourceLabel
- FreshnessLabel
- DataStatus
- SourceAndFreshness

Initial target fields:

- Flag
- Weather
- Hourly forecast
- Tides
- Webcam
- Beach attributes
- Lifeguard information

Acceptance criteria:

- Important dynamic values identify their source.
- Timestamps have an accessible absolute representation.
- Relative timestamps remain translated.
- Missing timestamps do not produce misleading text.
- Existing detail and home pages still work.

### Phase 2: Favorites

Objectives:

- Allow users to save beaches without an account.
- Persist favorites in localStorage.
- Add a favorite control to beach rows and beach details.
- Add a "Favorites" filter or section in the beach list.
- Provide useful empty-state text.
- Keep the storage implementation independent from React components.

Suggested structure:

- src/features/favorites/favoritesStorage.ts
- src/features/favorites/useFavorites.ts
- src/features/favorites/FavoriteButton.tsx

Storage format:

{
  "version": 1,
  "beachCodes": ["..."]
}

Acceptance criteria:

- Favorites survive reloads.
- Invalid stored data is handled safely.
- Favorite controls are keyboard accessible.
- Favoriting a beach does not trigger row navigation.
- Tests cover add, remove, duplicate and malformed-storage cases.

### Phase 3: Decision-oriented filters

Objectives:

- Extend the beach list with useful filters.
- Build filtering as pure domain logic before creating UI controls.
- Keep filters compatible with search and distance sorting.

First filter set:

- Recommended now
- Green flag
- Webcam available
- Lifeguard service available
- Accessible
- Parking
- Family friendly
- Surf suitable
- Favorites

Rules:

- Only expose filters supported by reliable existing data.
- Hide or disable filters whose data is unavailable.
- Do not infer live beach conditions from static attributes.
- Support more than one active filter.
- Show active filters clearly.
- Provide a reset action.

Suggested structure:

- src/features/beachFilters/types.ts
- src/features/beachFilters/filterBeaches.ts
- src/features/beachFilters/BeachFilterBar.tsx
- src/features/beachFilters/ActiveFilterChips.tsx

Acceptance criteria:

- Filtering logic has unit tests.
- Search, filters and sorting compose correctly.
- Mobile controls do not obscure the beach list.
- The result count updates correctly.
- Filter state can optionally be represented in the query string.

### Phase 4: Stable URLs and page metadata

Objectives:

- Give every beach a stable, human-readable URL.
- Preserve old code-based URLs through redirects or route compatibility.
- Add unique page titles and descriptions.
- Add canonical and social-sharing metadata.
- Generate a sitemap and robots.txt.

Proposed route:

- /playas/:municipalitySlug/:beachSlug

Compatibility:

- Continue accepting /playas/:codigo.
- Resolve legacy routes to the canonical route.
- Do not use the translated beach name as the permanent identity.
- Store or generate stable canonical slugs.

Metadata examples:

- Beach detail:
  "{Beach name}: flag, weather and tides today | Playas Cantabria"
- Municipality page:
  "Beaches in {Municipality}: current conditions | Playas Cantabria"

Suggested structure:

- src/seo/SeoHead.tsx
- src/seo/beachUrls.ts
- src/seo/metadata.ts
- scripts/generate-sitemap.mjs

Acceptance criteria:

- Every detail page has unique metadata.
- Canonical URLs are deterministic.
- Existing shared links continue working.
- Sitemap contains all canonical beach URLs.
- Android navigation remains unaffected.

### Phase 5: Static rendering for public routes

Objectives:

- Make useful page content available in generated HTML.
- Preserve the existing client-side application after hydration.
- Avoid a framework migration.
- Generate static entry points during the production build.

Initial routes:

- /
- /playas
- Every canonical beach page
- Municipality landing pages added in Phase 6

Implementation investigation:

1. Evaluate a post-build prerender script.
2. Generate route-specific index.html files inside build/.
3. Ensure Firebase serves generated files before applying the SPA rewrite.
4. Verify that Ionic does not produce hydration or navigation errors.
5. Keep normal SPA fallback for unknown routes.

Potential tooling:

- A small custom Puppeteer-based post-build script.
- react-helmet-async for route metadata.
- No runtime rendering service in the initial implementation.

Acceptance criteria:

- curl against a deployed beach URL returns meaningful beach text.
- Page title and metadata exist in the returned HTML.
- Client-side navigation still works.
- Direct navigation and refresh work for every generated route.
- Build fails clearly when prerender generation fails.
- Sitemap and prerendered routes use the same canonical URL generator.

### Phase 6: Municipality and curated landing pages

Objectives:

- Create useful landing pages from existing structured data.
- Avoid thin or automatically generated filler text.

Initial pages:

- /municipios/:municipalitySlug
- /playas-con-webcam
- /playas-accesibles
- /playas-con-socorrista
- /playas-para-familias
- /playas-para-surf

Each page must contain:

- A clear heading.
- A short factual introduction.
- Relevant beaches only.
- Current conditions when available.
- Links to canonical beach pages.
- Data-source clarification where appropriate.

Acceptance criteria:

- Pages are generated from shared selectors, not duplicated arrays.
- Empty categories are not published.
- Landing pages are included in the sitemap.
- Content remains factual and useful.
- No page claims current conditions when only static data exists.

### Phase 7: Static usual-crowding attribute

Objectives:

- Add usual crowding only when backed by a documented source.
- Model it explicitly as a static attribute.
- Avoid wording that could be confused with current occupancy.

Allowed labels:

- Usually low
- Usually moderate
- Usually high

Required presentation:

- Label: "Usual crowding"
- Static-information marker.
- Source attribution.
- No "updated X minutes ago" timestamp.

Acceptance criteria:

- The API and UI use an explicit static field name.
- It is never included in live status summaries.
- Filters use "usual crowding", not "occupancy now".
- Missing values remain unknown rather than inferred.

## Deferred to another branch

The following must not be implemented in this branch:

- Community occupancy reports.
- Jellyfish reports.
- Authentication.
- Notifications.
- Restaurants or nearby businesses.
- Backend moderation.
- User reputation.
- Changes to the core ranking formula.

## Verification after each phase

Run:

npm test -- --watchAll=false
npm run lint
npm run build
npm run perf:budget

Also manually verify:

- Home page
- Beach list
- Beach detail
- Map
- Direct route loading
- Back navigation
- Spanish and other supported languages
- Mobile viewport
- Favorite persistence where applicable

## Commit strategy

- docs: audit discovery and metadata architecture
- feat: expose data sources and freshness
- feat: add local beach favorites
- feat: add beach discovery filters
- feat: add canonical beach URLs and metadata
- feat: prerender public beach routes
- feat: add municipality and curated beach pages
- feat: add sourced usual crowding attribute

## Definition of done

- All automated checks pass.
- Existing routes remain compatible.
- New functionality is translated and accessible.
- Important data shows its source and freshness.
- Generated public pages contain meaningful HTML.
- No live claims are produced from static data.
- The branch is ready for independent review before merging.
