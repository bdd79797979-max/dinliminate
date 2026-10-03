# CP849 — Dinner Together Back Navigation

- Top-left Back is navigation only and returns to Home.
- It does not leave an active Family dinner or remove the member from the active round.
- Explicit Family Mode Leave remains responsible for leaving the family/session.
- Existing Family session state is preserved when navigating Home.
- Verified the existing hosted UI flow with TinyFish before the source change; the hosted CP848 build currently returns Home in the tested no-active-round path.
