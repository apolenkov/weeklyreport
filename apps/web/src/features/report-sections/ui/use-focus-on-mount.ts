import { useEffect, useRef } from "react";

// A freshly mounted composer (including the next one after Save and add
// another) is opened to type into, so focus starts on its first field.
export function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return ref;
}
