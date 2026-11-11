import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { countryOptions, findCountry } from "@/lib/countries";
import CountryCombobox from "./CountryCombobox";

function StatefulCombobox({ initialValue = "" }: { initialValue?: string }) {
  const [value, setValue] = useState(initialValue);
  return <CountryCombobox label="Origin country" value={value} onChange={setValue} />;
}

describe("CountryCombobox", () => {
  it("uses the complete assigned ISO 3166-1 country list", () => {
    expect(countryOptions).toHaveLength(249);
    expect(findCountry("US")?.name).toBe("United States");
    expect(findCountry("usa")?.name).toBe("United States");
    expect(findCountry("United States of America")?.code).toBe("US");
  });

  it("searches case-insensitively and selects with Enter", async () => {
    const user = userEvent.setup();
    render(<StatefulCombobox />);

    await user.click(screen.getByRole("combobox", { name: "Origin country" }));
    await user.type(screen.getByRole("searchbox", { name: "Search origin country" }), "vIeTnAm");
    expect(screen.getByRole("option", { name: "Vietnam" })).toBeVisible();

    await user.keyboard("{Enter}");
    expect(screen.getByRole("combobox", { name: "Origin country" })).toHaveTextContent("🇻🇳Vietnam");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("supports arrow navigation and Escape without accepting search text", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CountryCombobox label="Destination country" value="" onChange={onChange} />);
    const combobox = screen.getByRole("combobox", { name: "Destination country" });

    combobox.focus();
    await user.keyboard("{ArrowDown}");
    const search = screen.getByRole("searchbox", { name: "Search destination country" });
    await user.type(search, "not a real country");
    expect(screen.getByText("No country found.")).toBeVisible();
    await user.keyboard("{Enter}");
    expect(onChange).not.toHaveBeenCalled();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await waitFor(() => expect(combobox).toHaveFocus());
  });

  it("shows ISO-code and unknown legacy values without rewriting them", () => {
    const { rerender } = render(<CountryCombobox label="Origin country" value="VN" onChange={vi.fn()} />);
    expect(screen.getByRole("combobox", { name: "Origin country" })).toHaveTextContent("🇻🇳Vietnam");

    rerender(<CountryCombobox label="Origin country" value="Legacy Equestria" onChange={vi.fn()} />);
    expect(screen.getByRole("combobox", { name: "Origin country" })).toHaveTextContent("🌐Legacy Equestria");
  });
});
