# Shape Shifters · DesK Apps

Secret-placement strategy game for phones, tablets and desktop browsers. Includes the supplied DesK Apps logo and a two-second splash.

## Play modes

- You against one computer.
- You against two computers.
- Two to four humans passing one device, with private handover screens.
- Two to four humans on separate devices using an invite link or 10-character room code.

Computers generate valid layouts independently **before** your turn and never read your placements.

## Rules implemented

Each player places one triangle, square, circle and line barrier. Positions snap to the intersections of a 10×10 grid. Rotation uses 15° steps. Own shapes cannot overlap; touching edges is allowed. At least 90% of each shape's area must remain on board.

All shapes stay private until everyone locks in. The reveal fades the grid, resolves triangle-tip attacks simultaneously, checks Ultimate Victory, then scores.

- **Triangle:** only its three tips eliminate vulnerable opponent shapes. Destroyed triangles still attack in that reveal, allowing mutual destruction.
- **Square:** immune to triangle-tip attacks.
- **Line barrier:** protects any shape it touches, including opponents. Sacrifices itself to absorb attacks on touching shapes or tips hitting the line itself. Protection lasts for that simultaneous reveal.
- **Circle:** smaller than the square. A surviving circle completely inside an opponent's square triggers Ultimate Victory. All qualifying players share that victory, overriding normal scores.

Scoring convention for this first full build: a surviving shape earns the percentage of its full area that is on-board and unobstructed by surviving opponent shapes, up to 100 points. Circles earn double, up to 200. Destroyed shapes and sacrificed barriers earn zero. Highest total wins, maximum 500; ties within 0.005 points share victory. Display rounding does not determine ties. Overlap is counted once, using convex clipping and union area; circle outlines use a 72-sided polygon for area calculation, with exact circle-in-square containment. One placement and reveal is one game; Play again starts afresh.

## Run and test

Requires Node 22 or newer.

```sh
npm ci
npm test
npm run dev
```

Development serves on port 3000 (or `PORT` / `--port`) and uses an **in-memory** room store. Restarting development clears test rooms. Production uses the same room service with Netlify Blobs.

```sh
npm run build
```

Static files are generated in `dist`. Computer and pass-and-play modes also work on any static host; online rooms require the Netlify function.

## Netlify deployment

Connect this repository in Netlify. The included `netlify.toml` sets:

- Build: `npm run build`
- Publish directory: `dist`
- Functions directory: `netlify/functions`
- Node: 22

No Supabase project, API key or login is needed. Netlify Functions supplies the Netlify Blobs context automatically. Deploy through Git integration or Netlify CLI, rather than dragging only `dist` into a static deploy (which omits functions).

Online room state uses strong consistency and conditional writes to protect concurrent joins and submissions. The server validates layouts and never releases any layout until all players have submitted. Names are rendered as text. Player/host credentials are random, stored in the original browser and never included in public room state. Refresh or reopen in the same browser to rejoin. A new browser cannot recover a slot using only its name. Hosts can close a room by leaving. Rooms expire logically after two hours; expired room blobs are not automatically purged from the Netlify store. Expiry never exposes layouts.

## Verification

`npm test` covers geometry, placement restrictions, off-board area, triangle tips versus edges, immunity, simultaneous destruction, barriers protecting other owners, Ultimate Victory and shared wins, union overlap scoring, 200 valid computer layouts, 50 complete four-player simulations, and room concurrency/authentication/privacy/rejoin/cancellation/expiry.

Browser QA uses the development adapter; a live Netlify two-device smoke test remains necessary to verify the deployed Blobs binding, network behaviour and native invite sharing on real phones.
