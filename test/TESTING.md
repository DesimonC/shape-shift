# Manual acceptance checks

Use a Netlify **Git-connected deploy** for online tests.

1. One computer: place four shapes, move and rotate them, lock in, reveal, inspect events/scores, Play again.
2. Two computers: same, confirm three colours and scorecards.
3. Pass & play: choose 2/3/4 humans; confirm previous placements disappear before each handover, reveal only after everyone locks.
4. Reject own overlaps and placements more than 10% off board. Lock remains disabled until all four shapes are valid.
5. Online: host on one device, send invite to another; host sees join; start; both place. No opponent shapes visible before both lock. Both see the same result.
6. Refresh before lock: own draft returns. Refresh after lock: remains locked. Same-browser rejoin resumes the slot.
7. Disconnect: return on the same browser. No duplicate slot. Network failure produces a retry message.
8. Share: Android and iPhone share sheet / clipboard; invite opens Join with the room code filled.
9. Phone: portrait/landscape, touch placement and drag-to-move; controls/score tables remain within the viewport.
10. Rules dialog and leave confirmation support keyboard and Escape. Leaving as host closes the room for everyone.

Scoring and circle bonus values are visible in How to play and may be tuned after Desimon's playtest.
