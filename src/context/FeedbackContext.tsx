import { createContext, useContext, useState, ReactNode } from "react";

interface FeedbackContextType {
  lastFeedbackTs: number;
  setLastFeedbackTs: (ts: number) => void;
}

const FeedbackContext = createContext<FeedbackContextType>({
  lastFeedbackTs: 0,
  setLastFeedbackTs: () => {},
});

export const FeedbackProvider = ({ children }: { children: ReactNode }) => {
  const [lastFeedbackTs, setLastFeedbackTs] = useState(0);
  return (
    <FeedbackContext.Provider value={{ lastFeedbackTs, setLastFeedbackTs }}>
      {children}
    </FeedbackContext.Provider>
  );
};

export const useFeedback = () => useContext(FeedbackContext);
