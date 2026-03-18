import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface LocationOption { value: string; label: string; timezone: string; }
interface LocationContextType {
  selectedLocation: LocationOption | null;
  setSelectedLocation: (loc: LocationOption | null) => void;
  currentTime: string;
}

const LOCATIONS: LocationOption[] = [
  { value: "IN", label: "India",          timezone: "Asia/Kolkata" },
  { value: "US", label: "United States",  timezone: "America/New_York" },
  { value: "UK", label: "United Kingdom", timezone: "Europe/London" },
  { value: "AU", label: "Australia",      timezone: "Australia/Sydney" },
  { value: "SG", label: "Singapore",      timezone: "Asia/Singapore" },
  { value: "AE", label: "UAE",            timezone: "Asia/Dubai" },
  { value: "DE", label: "Germany",        timezone: "Europe/Berlin" },
  { value: "JP", label: "Japan",          timezone: "Asia/Tokyo" },
];

const LocationContext = createContext<LocationContextType>({
  selectedLocation: null,
  setSelectedLocation: () => {},
  currentTime: "",
});

export const LocationProvider = ({ children }: { children: ReactNode }) => {
  const [selectedLocation, setSelectedLocation] = useState<LocationOption | null>(
    LOCATIONS.find(l => l.value === "IN") || null
  );
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    const tick = () => {
      if (!selectedLocation) return;
      setCurrentTime(
        new Date().toLocaleTimeString("en-US", {
          timeZone: selectedLocation.timezone,
          hour: "2-digit", minute: "2-digit", second: "2-digit",
        })
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [selectedLocation]);

  return (
    <LocationContext.Provider value={{ selectedLocation, setSelectedLocation, currentTime }}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation      = () => useContext(LocationContext);
export const useLocationOptions = () => LOCATIONS;
