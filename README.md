# SmartVenue - Intelligent Attendee Dashboard

## Chosen Vertical
**Physical Event Experience**

## Approach and Logic
SmartVenue is designed as a progressive web application (PWA) prioritizing accessibility, real-time data flow, and high code quality. The application utilizes a modern React frontend paired with Firebase (Auth and Firestore) to deliver instant updates. 

To ensure enterprise-grade reliability, the architecture implements:
- **Type Safety:** Component prop validation using PropTypes.
- **Resilience:** React Error Boundaries to prevent total application crashes.
- **Accessibility (a11y):** 100% WCAG compliance utilizing ARIA live regions, hidden decorative SVGs, and semantic HTML tags.
- **CI/CD:** Automated GitHub Actions pipeline enforcing Vitest coverage and build verification on every push.

## How the Solution Works
1. **Authentication:** Users authenticate via Google OAuth or Email/Password, managed securely by Firebase Auth.
2. **Live Dashboard:** The `HomePage` establishes a real-time WebSocket connection (`onSnapshot`) to Firestore, displaying live crowd density across different stadium zones.
3. **Smart Navigation:** Attendees receive dynamic alerts and "Smart Tips" (e.g., routing to less crowded gates) processed via data state changes.
4. **Deployment:** The application is containerized using Docker (Nginx/Alpine) and deployed to a scalable Google Cloud Run environment.

## Assumptions Made
- **Connectivity:** Attendees have continuous cellular or Wi-Fi data access inside the physical venue.
- **Hardware Context:** Attendees will primarily use the application on mobile devices; thus, the UI is strictly mobile-first with safe-area padding.
- **Backend Sync:** Venue administrators or IoT sensors are actively updating the `zones` and `alerts` Firestore collections to feed the real-time React listeners.
