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
    if (active !== this.active) {
      this.active = active;
      this.panel.classList.toggle("trip-compact", active);
      this.details.hidden = !active;
      this.details.setAttribute("aria-expanded", "false");
      this.details.textContent = "Journey details";
    }
    text("tripTitle", s.name);
    document.getElementById("discoveryChoice").hidden = active;
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
        ? "Arrived · Take a moment"
        : active
          ? s.objectiveLabel
          : s.description,
    );
    text(
      "tripGuidance",
      done
        ? `${Math.floor(s.elapsed / 60)}m ${Math.floor(s.elapsed % 60)}s · ${s.quality}`
        : active
          ? s.guidance || `Continue on ${s.road || "the local road"}`
          : `${(s.distance / 1000).toFixed(1)} km · Manual or auto-drive`,
    );
    text(
      "tripSecondary",
      done
        ? s.reason
        : active
          ? s.arrival && s.finalObjective && s.remaining < 70
            ? `Marked bay · stop for 2 seconds${s.arrival.dwell > 0 ? " · settling in…" : ""}`
            : `${s.finalObjective ? "Destination" : "Checkpoint"} in ${s.nextDistance >= 1000 ? (s.nextDistance / 1000).toFixed(1) + " km" : Math.round(s.nextDistance) + " m"} · Destination ${(s.remaining / 1000).toFixed(1)} km`
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
    this.details.removeEventListener("click", this.onDetails);
    this.details.remove();
    this.start.removeEventListener("click", this.onStart);
    this.cancel.removeEventListener("click", this.onCancel);
  }
}
