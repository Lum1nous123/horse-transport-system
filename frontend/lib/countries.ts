import isoCountries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";

isoCountries.registerLocale(enLocale);

export type CountryOption = {
  code: string;
  name: string;
  flag: string;
  searchText: string;
};

function flagFor(code: string) {
  return String.fromCodePoint(...code.split("").map((character) => 127397 + character.charCodeAt(0)));
}

export const countryOptions: CountryOption[] = Object.keys(isoCountries.getAlpha2Codes())
  // XK is commonly included by datasets, but it is not an assigned ISO 3166-1 code.
  .filter((code) => code !== "XK")
  .map((code) => {
    const name = isoCountries.getName(code, "en", { select: "alias" });
    const aliases = isoCountries.getName(code, "en", { select: "all" });
    return {
      code,
      name: typeof name === "string" ? name : code,
      flag: flagFor(code),
      searchText: [code, isoCountries.alpha2ToAlpha3(code), ...(Array.isArray(aliases) ? aliases : [])]
        .filter(Boolean)
        .join("\n")
        .toLocaleLowerCase("en"),
    };
  })
  .sort((left, right) => left.name.localeCompare(right.name, "en"));

export function findCountry(value: string | null | undefined) {
  const normalized = value?.trim().toLocaleLowerCase("en");
  if (!normalized) return undefined;
  return countryOptions.find((country) => country.searchText.split("\n").includes(normalized));
}
