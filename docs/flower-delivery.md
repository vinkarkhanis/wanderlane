# Monsoon Flower Delivery

Choose **Flower Delivery** on the opening screen to start directly, including
when the saved world is Endless. Free Drive keeps the saved world; Evening
Chai Run starts its existing Pune journey. The duration labels are estimates,
not timers. In Pune City, select **Monsoon Flower Delivery** under Discovery drive and
press **Start drive**. The fictional Baner flower stall uses the existing
validated Baner parking parcel. Stop in the marked bay for two continuous
seconds below 0.5 m/s to begin the pickup. A nine-second parked scene shows
an assistant collecting the wrapped bouquet, carrying it to the passenger
window, placing it on the seat and stepping clear. Driving controls hold the
car still during the interaction. Auto-drive resumes afterward; manual input
also becomes available again. Pause, restart and cancellation remain available.

The Baner stall is beside the bay, on the side away from the road, so the
departure corridor is clear. A short exterior camera view frames the handover;
reduced motion keeps the player's camera. The passenger window opens for loading.

Carry the flowers along the existing Baner–Pashan Explorer, choosing Park
Ridge Road or the approximately 140 m longer Wakeshwar Road detour. Park
at the fictional courtyard porch on the Pashan approach for two seconds
to deliver them. The flowers move from the stall to the vehicle, then to
the porch. A courtyard recipient steps forward and accepts the bouquet over
four seconds; reduced motion shows the settled pose immediately. Completion
displays a thank-you and plays the existing arrival
chime. Driving quality is optional feedback and never blocks a delivery.

While driving, the paper-wrapped bouquet rests on the passenger seat and follows
the cabin's suspension movement. **Look at flowers · passenger seat** offers a
driver's glance at it; **Back to the road** restores the previous camera. The
motorbike uses the rear pillion. Cancellation and delivery remove the carried
bouquet. It is no longer displayed on the boot lid.

The story starts about 80 m before the Baner bay, at canonical route
distance 1439.25 m. Its destination is the existing Pashan bay at 4905 m.
Both stops are original fictional scenes, not surveyed businesses or a
lake entrance. Story dressing stays behind the parking centre and does
not modify imported roads or generate another map. Free roam, restart,
vehicle changes, flight and the other drives retain their existing roles.

**Take a postcard** offers the full 1200 × 880 PNG for download and also
saves a 400 × 293 JPEG thumbnail in the Travel scrapbook with the vehicle,
season and selected route. Up to four recent destination photos persist
on this device. Older discovery data remains readable. Blocked storage
permits an in-memory scrapbook; full PNGs are saved only by downloading.
The completion panel also offers **Save this moment**. Both controls compose
the recipient and bouquet under the porch and settle the interaction before
capturing, so an early click cannot save an empty-handed arrival.

The route's existing frontages now receive the same detail treatment as the
Baner hero stretch. Cleared forecourts include edge planters, residential gate
piers and an open central entrance. Market roofs have varied parapets; existing
customer paths now include browsing gestures, chai collection and purchases
carried away from the counter. All artwork remains procedural and fictional.

Validation commands:

```
npm run test:flower:delivery
npm run test:flower:delivery:browser
npm run test:pune:journey
npm run test:city
npm test
npm run test:real-pune
npm run build:site
```

The browser test defaults to a preview at port 8126; set `WANDERLANE_URL`
to use another server. Evidence is written to `output/flower-delivery`.
It follows both real routes through pickup and delivery without jumping
to the destination, exercises keyboard and simultaneous touch input,
checks exactly-once arrival audio and reload persistence, and captures
desktop, portrait and landscape frames. Automated touch emulation is not
a physical phone performance benchmark.
