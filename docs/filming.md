# Filming Wanderlane

The Film button opens camera, framing, interface, captions, recording length and
download controls. These are part of the playable game in Pune, Endless and
Endless City. Normal driving and journey rules continue during filming.

## Recording

1. Begin a drive, enable sound, then choose Film.
2. Select portrait (720 × 1280) for Reels/Shorts or landscape (1280 × 720) for
   YouTube. Framing changes the camera's actual aspect ratio; it does not crop a
   landscape image. Screen uses the current viewport and graphics pixel ratio.
3. Choose Driving camera, Side tracking, Roadside pass, Cockpit, or Journey
   moments. Journey moments retains the game's pickup camera and frames the
   recipient at the completed flower delivery. Reduced motion retains the
   regular camera and suppresses weather particles.
4. Hide the driving interface. Press I to hide/show the filming panel; Escape
   restores the interface. Touch users can leave the filming panel visible;
   controls are excluded from exported footage.
5. Optionally enable Journey captions. Four-second captions introduce the
   current flower-story beat; leave these off for an uninterrupted ambient drive.
6. Choose a 30-second, 60-second or 10-minute limit. Record clip, then Stop
   recording when ready. The first recording prepares the browser encoder for
   three seconds before the take begins. Save recording downloads the file. Closing Film,
   pausing or resizing stops the current recording. Closing Film restores the
   original driving camera and screen dimensions.

Recordings include the game's master audio mix. Pune footage includes visible
OpenStreetMap attribution. Audio unlocks through the existing user gesture;
muted sound must be enabled before recording. Recordings stay on this device.
Save each clip before starting another or leaving the page. The browser selects
a supported WebM/MP4 encoder; the saved extension reflects the actual format.
The sample MP4 files were converted to H.264/AAC after capture.

The recorder requests fresh rendered frames at a target 30 fps without changing
the physics clock. Its status displays measured capture fps. Keep this near 30
with your chosen quality; a requested rate is not a guarantee on every device.
The 10-minute setting is available for long-form work; the browser regression
captures short samples rather than waiting through a full ten-minute recording.

## First three video formats to compare

| Format                         | Suggested sequence                                                            | Export                      |
| ------------------------------ | ----------------------------------------------------------------------------- | --------------------------- |
| Flower story, 20–35 seconds    | Pickup detail; bouquet on seat; rainy road; recipient and closing porch view  | Portrait; captions optional |
| Rain atmosphere, 10–15 seconds | Cockpit rain/wipers or passing vehicle; warm storefront; road                 | Portrait; no captions       |
| Relaxing drive, 5–10 minutes   | Continuous road/cockpit view with game ambience; gradual destination approach | Landscape; no captions      |

For a development comparison, keep the seed, vehicle, weather, road section,
quality and camera the same in both versions. Clearly label before and after.
These durations are editorial starting points, not platform requirements.
The in-game recorder records individual takes; trim and join a multi-shot story
in an editor. Describe authored scenes as Pune-inspired, not surveyed replicas.

Compare similar-length uploads within each platform: Shorts chose-to-view and
retention, Reels watch time and shares, and visits to the playable game. Change
one main creative choice at a time. No uploads or channel analytics are modified
by this feature.

## Validation

- `node tests/filming-browser.mjs`: keyboard/touch input; actual portrait and
  landscape captures; camera restoration; rain audio; reduced motion; bounded
  audio-node count after switching worlds. Set WANDERLANE_URL if needed.
- `node tests/flower-delivery-browser.mjs`: both real-road journeys, parked
  pickup, arrival, cinematic recipient view, postcards, persistence and touch.
- `node tests/monsoon-browser.mjs`: quality/intensity changes, cockpit effects,
  pause, reduced motion, audio, mode switches and touch.
- `output/filming-upgrade/`: recording samples and measured capture report.

Arrival remains earned by driving the route and staying in the marked bay.
The new recipient movement and porch dressing are presentation; filming cannot
skip objectives, award deliveries, or move the player.
