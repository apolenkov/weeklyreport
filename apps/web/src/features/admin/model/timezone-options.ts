// Curated IANA subset (not the ~600-zone full list) for Reminders + Settings.
export const TIMEZONE_OPTIONS: readonly {
  group: string;
  zones: readonly { value: string; label: string }[];
}[] = [
  {
    group: "Russia",
    zones: [
      { value: "Europe/Kaliningrad", label: "Kaliningrad (UTC+2)" },
      { value: "Europe/Moscow", label: "Moscow (UTC+3)" },
      { value: "Europe/Samara", label: "Samara (UTC+4)" },
      { value: "Asia/Yekaterinburg", label: "Yekaterinburg (UTC+5)" },
      { value: "Asia/Omsk", label: "Omsk (UTC+6)" },
      { value: "Asia/Novosibirsk", label: "Novosibirsk (UTC+7)" },
      { value: "Asia/Krasnoyarsk", label: "Krasnoyarsk (UTC+7)" },
      { value: "Asia/Irkutsk", label: "Irkutsk (UTC+8)" },
      { value: "Asia/Yakutsk", label: "Yakutsk (UTC+9)" },
      { value: "Asia/Vladivostok", label: "Vladivostok (UTC+10)" },
      { value: "Asia/Magadan", label: "Magadan (UTC+11)" },
      { value: "Asia/Kamchatka", label: "Kamchatka (UTC+12)" },
    ],
  },
  {
    group: "Europe",
    zones: [
      { value: "Europe/London", label: "London (UTC+0/+1)" },
      { value: "Europe/Berlin", label: "Berlin (UTC+1/+2)" },
      { value: "Europe/Paris", label: "Paris (UTC+1/+2)" },
      { value: "Europe/Istanbul", label: "Istanbul (UTC+3)" },
    ],
  },
  {
    group: "Americas",
    zones: [
      { value: "America/New_York", label: "New York (UTC-5/-4)" },
      { value: "America/Chicago", label: "Chicago (UTC-6/-5)" },
      { value: "America/Denver", label: "Denver (UTC-7/-6)" },
      { value: "America/Los_Angeles", label: "Los Angeles (UTC-8/-7)" },
      { value: "America/Sao_Paulo", label: "São Paulo (UTC-3)" },
    ],
  },
  {
    group: "Asia / Pacific",
    zones: [
      { value: "Asia/Dubai", label: "Dubai (UTC+4)" },
      { value: "Asia/Karachi", label: "Karachi (UTC+5)" },
      { value: "Asia/Kolkata", label: "Kolkata (UTC+5:30)" },
      { value: "Asia/Bangkok", label: "Bangkok (UTC+7)" },
      { value: "Asia/Shanghai", label: "Shanghai (UTC+8)" },
      { value: "Asia/Singapore", label: "Singapore (UTC+8)" },
      { value: "Asia/Tokyo", label: "Tokyo (UTC+9)" },
      { value: "Asia/Seoul", label: "Seoul (UTC+9)" },
      { value: "Australia/Sydney", label: "Sydney (UTC+10/+11)" },
    ],
  },
  {
    group: "Other",
    zones: [{ value: "UTC", label: "UTC" }],
  },
];

// The wire schema accepts any IANA-resolvable zone, wider than this curated
// list — keep a stored out-of-list value selectable so the select shows the
// real value instead of silently falling back to the first option.
export function timezoneOptionsWith(current: string): typeof TIMEZONE_OPTIONS {
  const known = TIMEZONE_OPTIONS.some((group) =>
    group.zones.some((zone) => zone.value === current),
  );
  if (known || current === "") return TIMEZONE_OPTIONS;
  return [
    { group: "Current", zones: [{ value: current, label: current }] },
    ...TIMEZONE_OPTIONS,
  ];
}
