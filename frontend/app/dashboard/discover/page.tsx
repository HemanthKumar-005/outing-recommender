"use client";

import { useState } from "react";
import LocationPicker, { type LocationSelection } from "../../../components/LocationPicker";
import RecommendPanel from "../../../components/RecommendPanel";
import SurpriseButton from "../../../components/SurpriseMe/SurpriseButton";

export default function DiscoverPage() {
  const [location, setLocation] = useState<LocationSelection | null>(null);

  return (
    <>
      <div className="dash-header">
        <h1 className="dash-greeting">Discover</h1>
        <p className="dash-sub">
          Choose any state and city/district in India. Places are ranked near that location from
          your catalog — nothing is locked to a single region.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 20, maxWidth: 640 }}>
        <h3 style={{ marginBottom: 12 }}>Where do you want to explore?</h3>
        <LocationPicker value={location} onChange={setLocation} />
      </div>

      {location && (
        <SurpriseButton
          lat={location.lat}
          lng={location.lng}
          occasion={undefined}
        />
      )}

      <RecommendPanel
        location={location}
        onLocationChange={setLocation}
        hideLocationPicker
      />
    </>
  );
}
