# Character artwork and instructor review

Five original AI-generated PNG atlases each contain six fixed pose illustrations. The same character reference was used for all five. The PNGs are opaque and use a warm neutral backdrop. There are no separate pose files because the app can select each exact square cell with CSS. A usable renderer and asset manifest are included.

All 30 cells were visually inspected for identity, layout and rough pose matching. This inspection is not an instructor or clinical assessment.

Before public instructional use, a qualified instructor should review every image and cue together, including body alignment, support placement, range of motion, entry, exit and bilateral instructions. The data retains visualStatus and visualReviewNote fields for that purpose.

Specific observations

- The tabletop image shows a mild back arch. Its instruction calls for a comfortable neutral spine.
- The Cow image lifts the chin. The instruction calls for a long, comfortable neck.
- The knees-down plank image shows some lumbar extension. Rib and pelvis alignment needs review.
- The crow preparation image is a grounded squat with palms down. It is labelled as preparation throughout.
- The kneeling setup image depicts sitting on the heels. It is used as a setup lesson before a teacher discusses tall kneeling or backbend progression.
- Still images cannot communicate safe movement timing or confirm an individual's readiness.
- Side changes are taught through text and teacher guidance. The app should avoid arbitrarily mirroring artwork with directional instructions.

The files supply a 3D animated-film visual style using static renders. True skeletal animation would require a rigged model and reviewed movement clips in a separate production step.

The original generation prompts are preserved in image-generation-prompts.json. Assets were produced with the built-in image-generation tool. The new application should not use Pixar branding or imply studio affiliation.
