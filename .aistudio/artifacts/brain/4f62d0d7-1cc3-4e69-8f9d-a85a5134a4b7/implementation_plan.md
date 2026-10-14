# Exponential Backoff Retry for 503 Service Unavailable and Error Display

## Overview & Core Concept
Implement an exponential backoff retry strategy for Google Gemini API calls (`generateOriginalStory`, `generateEnhancedStory`, and `sendChatMessage`) when encountering 503 Service Unavailable, 429 Rate Limit, or server overloaded errors. This avoids immediate high-speed retries that increase server load, while providing clear status updates in both the generation loading screen (`ResultsSkeleton`) and the AI assistant (`AssistantChatDrawer`).

## Key Requirements & Strategy
1. **Exponential Backoff Helper**:
   - Create a robust retry wrapper function with configurable base delay (e.g., 2000ms), multiplier (2x), and maximum retries (3 attempts).
   - Catch 503, 429, or network overload errors, wait for `initialDelay * 2^attempt`, and retry.
   - Accept an optional progress callback (`onRetry?: (attempt: number, delayMs: number, errorMsg: string) => void`) to report retry status in real-time.
2. **UI & AI Assistant Feedback**:
   - In `ResultsSkeleton`, display real-time retry status (e.g., "Google Gemini servers are busy (503). Retrying in 4s (Attempt 2 of 3)...") so the user sees exponential backoff progress.
   - In assistant chat (`AssistantChatDrawer` / `assistantChatService.ts`), handle 503/429 errors gracefully with backoff and display clear retry / error guidance in the assistant conversation.
