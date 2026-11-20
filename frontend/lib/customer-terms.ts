export const CUSTOMER_TERMS_LOGIN_HIDDEN_KEY = "hideCustomerTermsOnLogin";

export type CustomerTermsBlock =
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] };

export type CustomerTermsSection = {
  title: string;
  blocks: CustomerTermsBlock[];
};

export const CUSTOMER_TERMS_TITLE = "Horse Transport Service and Incident Policy";
export const CUSTOMER_TERMS_VERSION = "Version 1.0";

export const CUSTOMER_TERMS_SUMMARY = [
  "Your requested delivery date is a planning preference unless we separately confirm a commitment.",
  "You are responsible for accurate horse, route, recipient, contact, and document information, including meeting the displayed document deadlines.",
  "Paying the Deposit accepts the sent quotation. A paid Deposit is non-refundable under the current MVP rules, including if an Order is cancelled.",
  "The system records journey milestones. It does not provide live GPS, automatic traffic rerouting, airline booking checks, or an incident and claims workflow.",
  "If a delay or incident occurs, the operations team should prioritize safety, share verified updates, and discuss material changes when circumstances allow.",
];

export const CUSTOMER_TERMS_SECTIONS: CustomerTermsSection[] = [
  { title: "1. Service scope", blocks: [
    { type: "paragraph", text: "The system lets Customers submit transport requests, view journey milestones, and receive available in-app updates. A requested delivery date is a planning preference, not a guaranteed arrival date unless the company separately confirms a specific commitment." },
    { type: "paragraph", text: "The MVP may include ROAD, AIR, or combined route legs. Live GPS, automatic traffic rerouting, airline booking or verification, and incident or claims management are not currently provided by the software." },
  ] },
  { title: "2. Customer responsibilities", blocks: [
    { type: "paragraph", text: "Provide accurate Horse identification, microchip, origin and destination, recipient, contact, and document information. Submit required documents by the displayed deadline and promptly report known changes that may affect the trip." },
    { type: "paragraph", text: "Provide a reachable contact for time-sensitive updates." },
  ] },
  { title: "3. Quotation and payment", blocks: [
    { type: "paragraph", text: "Review the quotation before paying the Deposit. Under the current MVP rules, paying the Deposit confirms acceptance of the sent quotation. The Remaining Balance is due at the payment stage shown in the system." },
    { type: "paragraph", text: "A paid Deposit is non-refundable under the current MVP business rule, including when an Order is cancelled." },
  ] },
  { title: "4. Documents and deadlines", blocks: [
    { type: "paragraph", text: "The Customer is responsible for submitting documents for each Horse. The assigned Transport Specialist reviews submitted versions and may approve or reject them with a reason." },
    { type: "paragraph", text: "If a document is rejected, submit a corrected version within the deadline or correction window shown by the system, when applicable. A document submitted on time and still awaiting review is not treated as late only because it has not yet been reviewed." },
    { type: "paragraph", text: "The system does not currently verify document authenticity or enforce certificate expiry-date rules. The checklist is not approval by a government authority." },
  ] },
  { title: "5. Delays and route changes", blocks: [
    { type: "paragraph", text: "Weather, traffic, road closures, vehicle issues, authority checks, and other unexpected events may delay a trip." },
    { type: "paragraph", text: "When a delay becomes known, the operations team should:" },
    { type: "list", items: [
      "Check the safety and welfare of the Horse and people involved.",
      "Assess the available route or schedule options.",
      "Inform the Customer of the known reason, latest estimated arrival, and when the next update is expected.",
      "Record the known timeline and operational decision.",
      "Discuss a material route, vehicle, schedule, or cost change with the Customer when circumstances allow.",
    ] },
    { type: "paragraph", text: "If immediate action is reasonably needed to protect people or the Horse, operations may act first and notify the Customer as soon as practical. Additional charges should be communicated and agreed in advance when circumstances allow. Weather or traffic delays do not automatically remove the company’s responsibility." },
    { type: "paragraph", text: "The MVP shows recorded journey milestones. It does not provide live GPS or automatically calculate a new ETA from traffic or weather." },
  ] },
  { title: "6. Horse health and welfare", blocks: [
    { type: "paragraph", text: "Customers should disclose known health or handling information relevant to transport. During the trip, the operations team and transport staff should prioritize the safety and welfare of people and Horses." },
    { type: "paragraph", text: "Welfare photos and notes record observations at a point in time; they are not a veterinary diagnosis." },
  ] },
  { title: "7. Emergency response", blocks: [
    { type: "paragraph", text: "An incident may include injury or illness, a Horse escaping or becoming separated from a vehicle, a vehicle breakdown, a collision, a serious delay, or an event that prevents safe continuation." },
    { type: "paragraph", text: "When an incident occurs:" },
    { type: "list", items: [
      "People at the scene should prioritize human, traffic, and animal safety.",
      "The Driver should contact the operations team when it is safe to do so.",
      "The operations team should contact local emergency responders, an equine veterinarian, or other qualified assistance when appropriate.",
      "Untrained personnel should not attempt a dangerous rescue or chase a Horse into traffic.",
      "The operations team should update the Customer with verified information and the next expected update.",
      "The operations team should record the time, location, people contacted, decisions, and evidence that can be collected safely.",
      "The trip should continue only when the responsible operations person, with relevant professional advice where needed, considers the plan safe.",
    ] },
    { type: "paragraph", text: "For serious injury or death, the operations team should notify the Customer, preserve relevant records, and coordinate with veterinary professionals and authorities as appropriate. Responsibility and any remedy must be assessed after the facts are reviewed. This policy does not by itself decide fault, compensation, or insurance coverage." },
    { type: "paragraph", text: "The MVP software does not provide an incident investigation, insurance, or claims workflow. Some operational steps may need to be handled outside the system." },
  ] },
  { title: "8. Unexpected costs", blocks: [
    { type: "paragraph", text: "When practical, the operations team should tell the Customer about additional costs and obtain agreement before incurring them." },
    { type: "paragraph", text: "If urgent action is needed to protect people or the Horse and waiting for approval is not practical, operations may take necessary action within its authority and inform the Customer as soon as practical, with an explanation and available records. An unapproved cost is not automatically chargeable to the Customer." },
  ] },
  { title: "9. Pickup and delivery", blocks: [
    { type: "paragraph", text: "Provide accurate recipient details and ensure the recipient can coordinate at the delivery location." },
    { type: "paragraph", text: "If the recipient is unavailable, refuses delivery, or Horse or recipient details do not match, operations should contact the Customer and agree on the next step where circumstances allow. Delivery should not be recorded as complete before the required handover is completed." },
    { type: "paragraph", text: "Proof of Delivery is separate from welfare evidence. The MVP does not require the recipient to have an account, use OTP, or sign electronically." },
  ] },
  { title: "10. Raising a concern", blocks: [
    { type: "paragraph", text: "Contact the operations team as soon as practical if you identify a concern about Horse welfare, a delay, a handover, or information shown for your trip. The team should acknowledge the report, preserve relevant information, and explain the next review step." },
    { type: "paragraph", text: "Receiving a report does not itself determine fault or compensation." },
  ] },
];

export function isCustomerTermsLoginHidden(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(CUSTOMER_TERMS_LOGIN_HIDDEN_KEY) === "true";
  } catch {
    return false;
  }
}

export function hideCustomerTermsOnLogin(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CUSTOMER_TERMS_LOGIN_HIDDEN_KEY, "true");
  } catch {
    // The preference is optional; keep the modal usable if browser storage is unavailable.
  }
}
