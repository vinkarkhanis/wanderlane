# Monsoon atmosphere

Choose **Monsoon Pashan Drive** and start the trip, or select **Monsoon**
under **Weather** in Settings. The Weather selector works in Pune city,
Endless Drive and Endless City. In Pune it stays synchronized with Pune
Season; choosing Clear returns Pune to Summer. Pune and Endless preferences
persist separately, so switching drive modes retains each weather choice.

In Monsoon, select **Light** or **Heavy** under **Monsoon rain** in Settings.
Heavy is the initial default; the selected intensity persists across reloads
and works in every drive mode. Light uses 360 / 720 / 1200 streaks on Low /
Medium / High, and Heavy uses 1200 / 2800 / 4800. The rain volume follows the
camera horizontally so chase and cockpit both see nearby falling rain.
Streaks have feathered edges and independent fall speeds,
lengths, widths and opacity, with gentle wind drift. Their world-space
motion stays independent of the car. Wet asphalt includes irregular,
noise-based reflective patches using
the existing environment map. These are stylized sky highlights, rather
than reflections of nearby cars or buildings. Pune retains its existing
placed puddles. Small expanding impact rings are pooled along the current
road, with 12 / 24 / 32 in Light and 24 / 48 / 64 in Heavy on Low / Medium /
High. Heavy adds thicker, brighter streaks, denser splashes, stronger spray,
faster wipers, more windshield beads, darker skies, 190 m visibility and
louder rainfall. Rain also softens the sky,
sunlight and viewing distance; stars and the moon are obscured in rain.

Tyre mist appears on asphalt when moving above 2 m/s, with 24 / 56 / 96
pooled particles. It stops while airborne or off asphalt. Cockpit rain is
mapped onto each enclosed vehicle's actual windshield geometry; two
automatic wipers clear droplets along their sweep. Beads have subtle glints,
varying lifetimes, gravity trails and fresh positions as they reform.
Motorbikes have no
windshield effects. Windshield textures refresh at 15 Hz on Low and 24 Hz
otherwise. Reduced motion disables streaks, spray and windshield animation
while retaining wet surfaces and rain sound. Pausing freezes weather motion.

Rain audio uses a fixed synthesized noise source, filtered for cockpit
listening, with additional wet tyre hiss as speed rises. It respects
ambience volume, master volume, mute and pause, and starts through the
existing sound gesture. World and vehicle switching reuse weather pools
and audio nodes. No external assets or network requests are added.

Validation: `npm run test:monsoon:browser` (preview at port 8125 by default,
or set `WANDERLANE_URL`). The browser checks include actual keyboard and
simultaneous touch input, three quality levels, measured rain audio RMS,
pause, reduced motion, bike exclusion, repeated mode switches, sound
controls, weather persistence and desktop/portrait/landscape screenshots.
Evidence is saved in `output/monsoon/`. These quality limits are effect
budgets; they are not a certified frame-rate benchmark on physical phones.
