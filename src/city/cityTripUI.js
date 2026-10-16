export class CityTripUI {
  constructor(onStart, onCancel) {
    this.panel = document.getElementById("cityTrip");
    this.details = document.createElement("button");
    this.details.type = "button";
    this.details.id = "tripDetails";
    this.details.hidden = true;
    this.details.textContent = "Journey details";
    this.details.setAttribute("aria-expanded", "false");
    this.panel.append(this.details);
    this.delivery = document.createElement("div");
    this.delivery.id = "deliveryMoment";
    this.delivery.hidden = true;
    const note = document.createElement("p");
    note.textContent =
      "“You brought them through the rain! Come, leave them here. They’re lovely.”";
    const capture = document.createElement("button");
    capture.type = "button";
    capture.id = "deliveryPostcard";
    capture.textContent = "Save this moment →";
    this.onCapture = () => document.getElementById("postcardBtn").click();
    capture.addEventListener("click", this.onCapture);
    this.capture = capture;
    this.delivery.append(note, capture);
    this.panel.insertBefore(
      this.delivery,
      this.panel.querySelector(".trip-actions"),
    );
    this.onDetails = () => {
      const compact = this.panel.classList.toggle("trip-compact");
      this.details.setAttribute("aria-expanded", String(!compact));
      this.details.textContent = compact ? "Journey details" : "Hide details";
      this.details.blur();
    };
    this.details.addEventListener("click", this.onDetails);
    this.start = document.getElementById("tripStart");
    this.cancel = document.getElementById("tripCancel");
    this.onStart = () => {
      onStart();
      this.start.blur();
    };
    this.onCancel = () => {
      onCancel();
      this.cancel.blur();
    };
    this.start.addEventListener("click", this.onStart);
    this.cancel.addEventListener("click", this.onCancel);
  }
  update(s, visible) {
    this.panel.hidden = !s || !visible;
    if (!s || !visible) return;
    const text = (id, value) => {
      const e = document.getElementById(id);
      if (e.textContent !== value) e.textContent = value;
    };
    const active = s.status === "active",
      done = s.status === "completed";
    this.delivery.hidden = !(done && s.cargo === "delivered");
    const arrival = active && s.arrival && s.stopping && s.stopRemaining < 70;
    this.panel.dataset.status = s.status;
    text(
      "tripDirection",
      done
        ? "✓"
        : arrival
          ? s.arrival.stage === "approach" || s.arrival.stage === "driving"
            ? "↰"
            : "P"
          : ({ left: "↰", right: "↱", straight: "↑" }[s.direction] ?? "↑"),
    );
    document.getElementById("tripArrival").hidden = !arrival;
    if (arrival) {
      const settling = s.arrival.stage === "settling";
      text(
        "tripArrivalHint",
        settling
          ? `Stay still · ${Math.max(0, 2 - s.arrival.dwell).toFixed(1)} s`
          : s.arrival.stage === "parking"
            ? "Brake gently and come to a stop"
            : "Look for the P sign · pull into the bay on the left",
      );
      document.getElementById("tripArrivalProgress").value = s.arrival.dwell;
    }
    if (active !== this.active) {
      this.active = active;
      this.panel.classList.toggle("trip-compact", active);
      this.details.hidden = !active;
      this.details.setAttribute("aria-expanded", "false");
      this.details.textContent = "Journey details";
    }
    text("tripTitle", s.name);
    document.getElementById("discoveryChoice").hidden = active || done;
    text(
      "tripEyebrow",
      done
        ? "A LITTLE TIME WELL SPENT"
        : active
          ? s.district.toUpperCase()
          : "PUNE · AN EVENING JOURNEY",
    );
    text(
      "tripObjective",
      done
        ? s.cargo === "delivered"
          ? "Flowers delivered · Thank you"
          : "Arrived · Take a moment"
        : active
          ? s.objectiveLabel
          : s.description,
    );
    text(
      "tripGuidance",
      done
        ? s.completion
        : active
          ? `${s.cargo === "awaiting pickup" && !arrival ? "Collect flowers at the marked Baner bay. " : ""}${s.guidance || `Continue on ${s.road || "the local road"}`}`
          : `${(s.distance / 1000).toFixed(1)} km · Manual or auto-drive`,
    );
    text(
      "tripSecondary",
      done
        ? `${Math.floor(s.elapsed / 60)}m ${Math.floor(s.elapsed % 60)}s · ${s.quality} · ${s.reason}`
        : active
          ? arrival
            ? s.cargo === "awaiting pickup"
              ? "Collect flowers · stay parked for 2 seconds"
              : `${s.destination} · park here for 2 seconds`
            : `${s.cargo === "onboard" ? "Flowers onboard · " : ""}${s.destination} · ${s.remaining >= 1000 ? (s.remaining / 1000).toFixed(1) + " km" : Math.round(s.remaining) + " m"} remaining`
          : "Follow the road. Take the long way.",
    );
    text("tripMarathi", active ? s.marathi : "");
    this.panel.dataset.character = s.character;
    document.getElementById("tripProgress").value = s.progress;
    document.getElementById("tripProgress").hidden = !active;
    this.start.hidden = active;
    text("tripStart", done ? "Drive again" : "Start drive");
    this.cancel.hidden = !active && !done;
  }
  dispose() {
    this.capture.removeEventListener("click", this.onCapture);
    this.delivery.remove();
    this.details.removeEventListener("click", this.onDetails);
    this.details.remove();
    this.start.removeEventListener("click", this.onStart);
    this.cancel.removeEventListener("click", this.onCancel);
  }
}
