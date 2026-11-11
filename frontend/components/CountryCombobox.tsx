"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { countryOptions, findCountry } from "@/lib/countries";

type CountryComboboxProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

export default function CountryCombobox({ label, value, onChange }: CountryComboboxProps) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const activeOptionRef = useRef<HTMLLIElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const selectedCountry = findCountry(value);
  const filteredCountries = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("en");
    return needle ? countryOptions.filter((country) => country.searchText.includes(needle)) : countryOptions;
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => searchRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => activeOptionRef.current?.scrollIntoView?.({ block: "nearest" }));
    return () => cancelAnimationFrame(frame);
  }, [activeIndex, filteredCountries, open]);

  useEffect(() => {
    if (!open) return;
    function closeOnOutsidePointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsidePointer);
    return () => document.removeEventListener("mousedown", closeOnOutsidePointer);
  }, [open]);

  function closeAndRestoreFocus() {
    setOpen(false);
    setQuery("");
    requestAnimationFrame(() => buttonRef.current?.focus());
  }

  function openPopover() {
    const selectedIndex = countryOptions.findIndex((country) => country.code === selectedCountry?.code);
    setQuery("");
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }

  function selectCountry(index: number) {
    const country = filteredCountries[index];
    if (!country) return;
    onChange(country.name);
    closeAndRestoreFocus();
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => filteredCountries.length ? (current + 1) % filteredCountries.length : 0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => filteredCountries.length ? (current - 1 + filteredCountries.length) % filteredCountries.length : 0);
    } else if (event.key === "Enter") {
      event.preventDefault();
      selectCountry(activeIndex);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeAndRestoreFocus();
    }
  }

  const displayName = selectedCountry?.name ?? value.trim();

  return <div className="customer-field customer-country-field" ref={rootRef}>
    <span>{label}</span>
    <button
      ref={buttonRef}
      type="button"
      className="customer-country-trigger"
      role="combobox"
      aria-controls={`${id}-listbox`}
      aria-label={label}
      aria-expanded={open}
      aria-haspopup="listbox"
      onClick={() => { if (open) closeAndRestoreFocus(); else openPopover(); }}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          openPopover();
        } else if (event.key === "Escape" && open) {
          event.preventDefault();
          closeAndRestoreFocus();
        }
      }}
    >
      <span className={displayName ? "" : "customer-country-placeholder"}>
        {displayName ? <><span aria-hidden="true">{selectedCountry?.flag ?? "🌐"}</span>{displayName}</> : "Select a country"}
      </span>
      <span className="customer-country-chevron" aria-hidden="true">⌄</span>
    </button>
    {open && <div className="customer-country-popover">
      <input
        ref={searchRef}
        type="search"
        value={query}
        aria-label={`Search ${label.toLocaleLowerCase("en")}`}
        aria-controls={`${id}-listbox`}
        aria-activedescendant={filteredCountries[activeIndex] ? `${id}-option-${filteredCountries[activeIndex].code}` : undefined}
        placeholder="Search countries…"
        onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }}
        onKeyDown={handleSearchKeyDown}
      />
      <ul id={`${id}-listbox`} className="customer-country-list" role="listbox" aria-label={`${label} options`}>
        {filteredCountries.map((country, index) => <li
          ref={index === activeIndex ? activeOptionRef : undefined}
          id={`${id}-option-${country.code}`}
          key={country.code}
          role="option"
          aria-selected={country.code === selectedCountry?.code}
          className={index === activeIndex ? "is-active" : ""}
          onMouseDown={(event) => event.preventDefault()}
          onMouseEnter={() => setActiveIndex(index)}
          onClick={() => selectCountry(index)}
        >
          <span aria-hidden="true">{country.flag}</span><span>{country.name}</span>
          {country.code === selectedCountry?.code && <b aria-hidden="true">✓</b>}
        </li>)}
        {filteredCountries.length === 0 && <li className="customer-country-empty">No country found.</li>}
      </ul>
    </div>}
  </div>;
}
