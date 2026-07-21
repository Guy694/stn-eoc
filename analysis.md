# STN EOC System Analysis

## Overview
The STN EOC (Emergency Operations Center) system is a web application built with Next.js and React, designed to manage emergency operations for flood, disease, accident, and other incident types. It provides dashboards, maps, reporting, and resource management for various user roles including administrators, EOC managers, staff, and the public.

## Technology Stack
- **Framework**: Next.js 16.2.10 (with Turbopack) and React 18
- **Styling**: Tailwind CSS via PostCSS
- **State Management**: React Context (AuthContext, EOCContext)
- **Data Layer**: MySQL database using `mysql2/promise` connection pool
- **API Routes**: Next.js App Router (`app/api/.../route.js`)
- **Icons**: Lucide React icons
- **Build Tools**: ESLint, Jest for testing

## Project Structure
```
stn-eoc/
├── app/                    # Next.js app router (pages and API routes)
├── components/             # Reusable React components
├── context/                # React context providers
├── data/                   # Static data files (JSON, JSX)
├── database/               # SQL and GeoJSON files for database setup
├── lib/                    # Utility functions and database connection
├── migrations/             # Database migration scripts
├── prompter/               # (Likely for AI prompts or chatbot)
├── public/                 # Static assets
├── scripts/                # Utility scripts
├── __tests__/              # Test files
├── config files            # package.json, next.config.mjs, eslint.config.mjs, etc.
└── analysis.md             # This file
```

## Key Features

### 1. Authentication and Authorization
- **AuthContext**: Manages user authentication state and role-based access control.
- **Roles**: admin, eoc_manager, eoc_staff, user, citizen, etc.
- **Permission System**: Menu items and API routes are guarded by role checks (`canAccessResources`, `canAccessReports`, etc.).

### 2. EOC Management
- Supports multiple EOC types: flood, disease, festival-accidents, and SAT (Public Health Office at district level).
- Each EOC type has its own management dashboard, maps, records, and reporting.
- EOC sessions can be opened/closed, and each session has a type, number, start/end dates.

### 3. Disease Module
- Tracks disease outbreaks, patient statistics, and vulnerable groups.
- Features: daily risk summaries, patient records, facility management, and reports.
- **SAT (หน่วยงานสาธารณสุขอำเภอ)**: A specialized section under disease for district-level public health offices, with its own dashboard and report pages.

### 4. Flood Module
- Manages flood situations, including area records, shelter centers, affected populations, and disease reports in shelters.
- Integrates with map components to visualize flood areas and shelters.

### 5. Accident Module (Festival Accidents)
- Focuses on accident statistics during festivals (e.g., 7 dangerous days).
- Tracks accident records, service points, and year-over-year comparisons.

### 6. Resource and Logistics Management
- Manages personnel, vehicles, equipment, shelters, and IT resources.
- Includes medical inventory management (medicines, supplies) with stock tracking.

### 7. Reporting and Analytics
- Provides dashboards for executive overview, EOC-specific analytics, and incident reports.
- Allows generation of reports for disease, flood, accidents, and medical inventory.
- Pending reports and registrations are highlighted in the sidebar with badges.

### 8. Mapping and Geospatial Features
- Uses map components (likely Mapbox or similar) to display:
  - Flood areas and shelters
  - Disease outbreak locations
  - Village polygons (from `villagePolygonData.jsx`)
  - Health facility locations
- GeoJSON data is stored in the `database/` directory (e.g., `ampure.geojson`, `tambonnn.geojson`).

### 9. Medical Inventory
- Tracks medical supplies, stock levels, and movements.
- API endpoint: `/api/resources/medical-inventory`
- Initially relied on CSV files for seed data, but now uses database-only initialization.

### 10. User Interface
- **Layout**: Consistent layout with header, sidebar, and main content area.
- **Sidebar**: Collapsible menu sections with icons and badges for pending items.
- **Responsive Design**: Mobile-friendly with sidebar toggle for small screens.
- **Styling**: Tailwind CSS utility classes for rapid UI development.
- **Components**: Reusable components like StatCard, SkeletonLoader, ErrorMessage, SuccessMessage, etc.

## Data Flow
1. **Frontend**: React components fetch data from Next.js API routes.
2. **API Routes**: Handle requests, interact with the database via `lib/db.jsx`, and return JSON responses.
3. **Database**: MySQL stores all operational data (EOC sessions, incidents, resources, inventory, etc.).
4. **Static Data**: Some data (like district lists) is imported from `data/satunData.jsx`.

## Key Files and Their Purposes

### Frontend
- `app/layout.jsx`: Root layout with global styles and providers.
- `app/globals.css`: Global CSS (Tailwind base).
- `components/Sidebar.jsx`: Main navigation menu with role-based items.
- `components/layouts/EOCLayout.jsx`: Layout wrapper for EOC pages (header, sidebar, main).
- `components/StatCard.jsx`: Reusable statistic card component.
- `components/MapSelector.jsx`: Component for selecting map layers/basemaps.
- `components/HybridDisasterMap.jsx`: Map component for disaster visualization.

### Backend / API
- `app/api/resources/medical-inventory/route.js`: Medical inventory CRUD operations.
- `app/api/eoc/disease/daily-risk/route.js`: Disease daily risk data (used by SAT dashboard).
- `app/api/admin/incident-reports/route.js`: Incident reporting endpoints.
- `app/api/admin/registrations/route.js`: User registration management.

### Utilities and Context
- `lib/db.jsx`: MySQL connection pool and query helpers.
- `lib/auth.js`: Authentication helpers (token handling, role checking).
- `lib/eocDisplay.js`: Formats EOC type and number for display.
- `context/AuthContext.jsx`: Provides user object and auth functions.
- `context/EOCContext.jsx`: Provides current EOC status and session info.

### Data
- `data/satunData.jsx`: Contains `satunDistricts` array for district dropdowns.
- `data/villagePolygonData.jsx`: Village polygon data for maps.
- `data/weather-watch.json`: Weather data (if used).
- `data/eoc-flood-management.json`: Flood management configuration.

### Database
- `database/`: Contains SQL files for table creation and GeoJSON for map data.
  - `villages.sql`: Village table schema and data.
  - `tambonnn.sql`: Subdistrict (tambon) table.
  - `ampure.geojson`: Amphoe (district) boundaries.
  - `tambonnn.geojson`: Tambon boundaries.

## Current Development Focus (Based on Conversation)
1. **Fixing Medical Inventory API**: Removed dependency on CSV files for seeding inventory data, fixed SQL syntax error.
2. **Adding SAT Module**: Created new menu group under disease for SAT (Public Health Office at district level) with dashboard and report pages.
3. **UI/UX Improvements**: Ensuring proper JSX syntax in newly created pages (fixed fragment errors in SAT dashboard).

## Potential Improvements
1. **TypeScript Migration**: Consider migrating to TypeScript for better type safety.
2. **State Management Optimization**: Evaluate moving to a state management library like Redux or Zustand for complex state.
3. **API Standardization**: Adopt REST or GraphQL conventions consistently across all endpoints.
4. **Testing Expansion**: Increase test coverage for components and API routes.
5. **Performance Optimization**: Implement React.memo, useMemo, and useCallback where appropriate; consider code splitting.
6. **Accessibility**: Ensure WCAG compliance for all UI components.
7. **Internationalization**: While currently Thai-focused, consider structuring for multi-language support.
8. **Documentation**: Maintain this analysis and add API documentation (e.g., with Swagger).

## Conclusion
The STN EOC system is a comprehensive emergency management platform with modular design for different incident types. It leverages modern web technologies to provide a responsive, role-based interface for managing crises. Recent work has focused on stabilizing the medical inventory API and expanding the disease module to include SAT-specific functionality.