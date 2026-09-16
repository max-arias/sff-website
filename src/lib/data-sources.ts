/**
 * Where the catalog comes from.
 *
 * One list so a source is credited and fetched from the same place: the intake
 * imports the workbook id from here rather than repeating it. Deliberately
 * dependency-free — the browser bundle imports this, so it must not reach into
 * the intake pipeline.
 *
 * Credit only sources whose values reach the catalog, since a name here is a
 * claim the UI cannot back up. Reviews (HWBusters) and case reference links
 * (smallformfactor.net) are in the workbook as hyperlink-only cells: the intake
 * stores their visible text, which is the literal word "Link", so neither is
 * shown or resolvable yet. See DATA.md.
 */

export const masterListSheetId = "1AddRvGWJ_f4B6UC7_IftDiVudVc8CJ8sxLUqlxVsCz4";

export const masterListSheetUrl = `https://docs.google.com/spreadsheets/d/${masterListSheetId}/edit`;

export const psuTierSourceUrl =
  "https://docs.google.com/spreadsheets/d/1akCHL7Vhzk_EhrpIGkz8zTEYfLDcaSpZRB6Xt6JWkc/edit";

export interface DataSource {
  label: string;
  href: string;
  /** What this source contributes to the catalog. */
  note: string;
}

export const dataSources: DataSource[] = [
  {
    label: "SFF PC Master List",
    href: masterListSheetUrl,
    note: "the catalog",
  },
  {
    label: "PSU tier list",
    href: psuTierSourceUrl,
    note: "power supply tiers",
  },
  {
    label: "Cybenetics",
    href: "https://www.cybenetics.com",
    note: "PSU efficiency and noise grades",
  },
];
