# Spatial shore prototype

The Shore chapter is a three-dimensional black-sand cove. The other three chapters keep their existing layered illustrations.

- Drag the shore to look around a full turn. Vertical look is clamped to keep the viewer above the beach.
- Arrow keys turn the focused canvas. Arrows on the chapter dock change chapters instead.
- Entering the shore resets its view toward the headland. Leaving it restores the illustrated chapter camera.
- The current chapter-aware environmental sound and hand-drawn controls are preserved. Sound stays opt-in.
- Reduced-motion system settings stop environmental animation and release glide. This release does not change the motion preference default.

The terrain is an illustrative, procedural cove, not a surveyed reconstruction. The source uses a single ground-height function to place rocks and vegetation. Repeated boulder geometry is instanced into four batches; beach grains add one batch. The sky uses the renderer's output colour conversion only in the spatial chapter, leaving the existing illustrated chapters unchanged.

## Verification

Run `npm ci`, `npm test`, `npm run test:audio`, and `node tests/shore-look.cjs`.

The spatial suite covers 390px and 1365px, both system motion modes, horizontal and vertical drag, more than one full turn, dock gesture isolation, canvas and dock keyboard behavior, chapter exit and re-entry. `ONLY=390`, `1365`, `rm-390`, or `rm-1365` selects one cell. Scene-input checks pin the controls; the separate chrome gate checks their ordinary retirement and wake behavior.

Audio checks prove opt-in, signal bounds, chapter changes, mute/context closure and replay. They do not establish listening quality. Browser checks do not establish physical-phone performance or Safari support.
