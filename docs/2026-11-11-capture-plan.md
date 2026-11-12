# Pose capture checkpoint

Based on the November 10 session checkpoint in the existing GestureBridge plan.

- Yigit writes the two coordinate calculations in `normalizeCoordinates` in `features.mjs`; Codex supplies pixel aspect correction, hand-size calculation, guards and a check using translated/scaled fixtures.
- Codex builds `recording.mjs`, adds Next/Previous/Neutral recording buttons, counts, re-recording and cancellation to the existing camera UI. Record three separate 3-second clips per label, at most five samples per second; keep examples only in memory.
- Invalid/no/multiple hands, hidden tab or camera stop discard the incomplete clip. Keep earlier complete clips. Reload clears examples.
- Verify recorder behavior with Node tests and the Vite build. Leave normalization visibly unfinished until Yigit completes it; check position/scale invariance afterward. User checks actual camera and recording.
- No classifier or slide controls in this checkpoint.
