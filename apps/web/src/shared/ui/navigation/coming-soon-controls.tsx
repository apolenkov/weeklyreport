import { ComingSoonIconButton } from "@customreport/ui/components/coming-soon-control";
import { Globe2, Moon } from "lucide-react";

export function LanguageComingSoonControl() {
  // TODO(i18n-future): replace this inert control with a real locale switch
  // when the dedicated i18n phase introduces dictionaries and routing.
  return (
    <ComingSoonIconButton
      icon={Globe2}
      shape="nav"
      ariaLabel="Language selection is coming soon"
      testId="language-coming-soon"
    />
  );
}

export function ThemeComingSoonControl() {
  // TODO(theme-future): replace this inert control with a real theme switch
  // once theming is promoted into a milestone.
  return (
    <ComingSoonIconButton
      icon={Moon}
      shape="nav"
      ariaLabel="Theme selection is coming soon"
      testId="theme-coming-soon"
    />
  );
}
