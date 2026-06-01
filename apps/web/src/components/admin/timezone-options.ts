/**
 * UFB-035 / UFB-048: curated list of IANA timezones reused by both the
 * Reminders Tab (per-policy fire-at editor) and the Settings → Reminders
 * sub-tab (org-wide default timezone). Grouped by region so the select stays
 * human-readable. Adding a new region? Append a new group; do not flatten.
 *
 * The full IANA list (~600 zones) would be unwieldy; this covers all Russian
 * time-zones plus the common EU/US/APAC zones the team works with.
 */
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
