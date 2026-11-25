import {
  IconToggle,
  ToggleGroup,
} from "@weeklyreport/ui/components/ui/toggle-group";
import {
  Calendar,
  CodeXml,
  FlaskConical,
  Infinity as InfinityIcon,
  Layers,
  LifeBuoy,
  PenTool,
  Search,
} from "lucide-react";
import { toast } from "sonner";
const stages = {
  Planning: Calendar,
  Analysis: Search,
  Design: PenTool,
  Development: CodeXml,
  Testing: FlaskConical,
  DevOps: InfinityIcon,
  Support: LifeBuoy,
};

export function StageIcon({ name }: { readonly name: string }) {
  const Icon = Object.hasOwn(stages, name)
    ? stages[name as keyof typeof stages]
    : Layers;
  return (
    <Icon role="img" aria-label={`Stage: ${name}`} className="size-4">
      <title>{name}</title>
    </Icon>
  );
}
export function StageLegend() {
  return (
    <div
      role="group"
      aria-label="Stage legend"
      className="flex flex-wrap gap-x-4 gap-y-1 py-2 text-xs text-muted-foreground"
    >
      {Object.keys(stages).map((name) => (
        <span key={name} className="inline-flex items-center gap-1">
          <StageIcon name={name} />
          {name}
        </span>
      ))}
    </div>
  );
}
export function StageToggles({
  owned,
  selected,
  onChange,
}: {
  readonly owned: readonly string[];
  readonly selected: readonly string[];
  readonly onChange: (names: string[]) => void;
}) {
  return (
    <ToggleGroup
      type="multiple"
      aria-label="Stage"
      className="flex flex-wrap"
      value={[...selected]}
      onValueChange={(names) => {
        if (names.length > 0) onChange(names);
        else toast.info("A record needs at least one stage.");
      }}
    >
      {[...new Set([...owned, ...selected])].map((name) => (
        <IconToggle key={name} value={name} label={name}>
          <StageIcon name={name} />
        </IconToggle>
      ))}
    </ToggleGroup>
  );
}
