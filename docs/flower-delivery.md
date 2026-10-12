# Monsoon Flower Delivery

In Pune City, select **Monsoon Flower Delivery** under Discovery drive and
press **Start drive**. The fictional Baner flower stall uses the existing
validated Baner parking parcel. Stop in the marked bay for two continuous
seconds below 0.5 m/s to collect the bouquet. Auto-drive handles both stops
and resumes after pickup; manual driving remains available throughout.

Carry the flowers along the existing Baner–Pashan Explorer, choosing Park
Ridge Road or the approximately 140 m longer Wakeshwar Road detour. Park
at the fictional courtyard porch on the Pashan approach for two seconds
to deliver them. The flowers move from the stall to the vehicle, then to
the porch. Completion displays a thank-you and plays the existing arrival
chime. Driving quality is optional feedback and never blocks a delivery.

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
