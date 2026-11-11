# Volcano spatial study

Checkpoint: November 12, 2026. This is a draft world, not a finished art pass.

## Shape and limits

Chapter 0 now uses an asymmetric cone, a depressed crater, radial channels,
instanced boulders and a continuous sea. Chapter 2 keeps the existing Shore.
The existing custom controls and chapter audio are preserved. No new sound,
plume, eruption claim or default-motion policy is introduced.

This is illustrative procedural geometry, not surveyed terrain. Its dimensions,
rocks and erosion channels must not be read as geographic measurements.

Morphology reference:
- https://volcano.si.edu/volcano.cfm?vn=284150
- https://volcano.si.edu/gallery/ShowImage.cfm?photo=GVP-09518

The Smithsonian description and Richard Moore's 1992 photograph support the
asymmetric cone and rilled slopes. Historical steaming is not evidence of a
current plume. The photograph is a reference only and is not shipped in the app.

## Verification at the first checkpoint

Local Chromium, not a physical phone:
- Terrain finite/bounded/deterministic checks, crater depression and continuity: pass.
- Volcano at 390x844 and 1365x844: four directions, full turn, pointer input,
  reduced-motion pixel stability, transfer to Shore and back, flat-chapter exit,
  and zero page errors: pass.
- Existing Shore all four cells (390/1365, reduced/full motion): pass.
- Existing chrome gate independently at widths 390 and 1365: pass.

- Existing audio structure/browser gate: pass (structure only, not listened to).

Full-motion Volcano at 390 and 1365 also passes full turn, pointer input,
chapter transfer and exit without page errors. Pixel stability is only asserted
for reduced motion.
Initial head f57c075 passed CI. Subsequent test-only changes need their own
CI result; local results do not imply a green run.
The reduced-motion environment interpolation now snaps rather than leaving
persistent subpixel drift. This does not change the default motion preference.

## Art still open

The first entry view establishes the cone but the other directions are sparse.
Ground, rock treatment, scale and camera composition need another pass. This
study is not accepted art and must not be presented as a finished release.

## Overnight composition pass, November 12

The entry camera now sits offshore at an illustrative oblique viewpoint. The
shoreline and water occupy the foreground rather than an undifferentiated ash
apron. The cone has a more uneven base and multiscale relief, a cooler ash
palette and a static fine sea pattern. The sea remains still under reduced
motion. This is art direction, not a reconstruction or a surveyed camera site.

Terrain checks and all four Volcano width/motion cells pass locally after this
pass; the 390 chrome regression also passes. The prior full Shore/audio matrix
was green at ff90d24. The new head still needs its own complete CI run.

The scene is still simplified and does not meet a photographic terrain bar.
Side and rear views are mostly ocean by design from this offshore position;
there is continuous geometry, not a hidden void. No new scenery or distant
island has been invented to fill those views.
