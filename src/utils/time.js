import ms from "ms";
export const parseDuration = (input) => {
  try {
    const msec = ms(input);
    return typeof msec === "number" ? msec : null;
  } catch { return null; }
};
export const now = () => Date.now();
