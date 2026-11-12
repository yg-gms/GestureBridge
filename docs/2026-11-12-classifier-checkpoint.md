# Live comparison learning checkpoint

- User reports recording works and has completed wrist-relative, hand-size normalization.
- Continue with the existing plan's five-neighbour classifier: Euclidean distances, four votes required, and mean distance to the nearest five.
- Assistant supplies validation, voting, live comparison UI and numerical tests. Yigit replaces the one unfinished line inside the distance loop with a squared-difference accumulation. The square root and input validation are supplied.
- Numerical classification tests explicitly skip while that line returns null. After editing, they run automatically, including checks for nearest-neighbour voting, split votes, and agreement on a distant unfamiliar pose.
- This is a learning checkpoint before calibration: comparison is labelled uncalibrated, and no slide commands are enabled. High neighbour agreement does not establish that an unfamiliar pose is safe to accept.
- Next: verify the completed distance calculation, test fresh poses, then implement fresh known/unrelated calibration captures and rejection as specified in GestureBridge_Hackathon_Plan.md. Hold/rearm and slide controls follow calibration.
- Changing source refreshes the page and clears recorded examples. No persistence or new dependencies added.
