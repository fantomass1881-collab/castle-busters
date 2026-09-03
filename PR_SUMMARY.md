Title: feat: pre-match draft, unit cards, WRECKER/BOMBER/NAPALMER units, raycast & animated collapse

Description:
- Adds a pre-match draft modal allowing players to pick up to 8 units to take into a match.
- Implements unit cards for available units and stores the selected composition in gameState.selectedUnits.
- Integrates three unit behaviors into gameplay:
  - WRECKER: line-based high damage to supports (raycast)
  - BOMBER: AOE explosive damage around a target cell
  - NAPALMER: line-based initial damage + DOT ticks along the path
- Implements grid-based structural collapse with recomputeSupported() and collapseUnsupported(), and an animated staggered destruction sequence.
- Adds Bresenham line algorithm for raycasting lines of fire; preview/highlight of the line before firing.
- Adds cooldowns for unit abilities and blocks unavailable units in match if they weren't selected in draft.
- UI: draft modal, unit selection buttons, unit cooldown visual state, highlights and destroyed animations, battle log messages.

Checklist / How to test manually:
- git fetch && git checkout feature/structural-collapse
- Run a local static server (eg. npx http-server .) and open index.html
- Verify the draft modal appears; select up to 8 units and press "Начать матч"
- In the match verify: unit buttons enabled only for selected units; WRECKER/BOMBER/NAPALMER fire correctly on click; logs show damage and collapse events; destroyed CSS animations occur.
- Try using units repeatedly and confirm cooldown behavior and that AI still performs basic attacks.

Notes / Risks:
- UI and styles are in index.html and assume the page uses the bundled CSS; some minor style collisions may occur.
- The implementation is prototypical: numeric balance parameters are in unitConfigs in game.js and require tuning.
- No automated tests included.

Author: fantomass1881-collab

Files changed (high-level):
- index.html — added draft modal UI and unit buttons; added styles for modal and unit cards
- game.js — added unit selection, unit behaviors (WRECKER, BOMBER, NAPALMER), raycast (bresenham), animateDestruction, recomputeSupported/collapseUnsupported, unit cooldowns, draft integration

Merge risk: Medium — changes touch core gameplay logic; recommend review and local playtesting before merging to main.
