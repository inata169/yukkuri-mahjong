import { compareCpus } from "./comparison.js";

self.onmessage = ({ data }) => {
  try {
    for (const result of compareCpus(data)) self.postMessage({ type: "progress", result });
    self.postMessage({ type: "complete" });
  } catch (error) {
    self.postMessage({ type: "error", message: error.message });
  }
};
