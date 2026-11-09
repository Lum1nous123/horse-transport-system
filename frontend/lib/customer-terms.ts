export const CUSTOMER_TERMS_LOGIN_HIDDEN_KEY = "hideCustomerTermsOnLogin";

export type CustomerTermsBlock =
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] };

export type CustomerTermsSection = {
  title: string;
  blocks: CustomerTermsBlock[];
};

// English translation of the team-approved Customer-facing “ĐIỀU KHOẢN VẬN CHUYỂN.docx”.
export const CUSTOMER_TERMS_INTRO: string[] = [
  "Please carefully read the important terms and information below before using the Horse Transport System and horse transport services.",
  "By continuing to use the service, the Customer acknowledges their responsibility to review the information, deadlines, documents, payments, and updates related to the Transport Order.",
];

export const CUSTOMER_TERMS_SECTIONS: CustomerTermsSection[] = [
  {
    title: "1. Scope of Transport Services",
    blocks: [
      { type: "paragraph", text: "Horse Transport System supports the registration, organization, and management of horse transport services based on information provided by the Customer, issued quotations, required documents, transport plans, and service milestones recorded in the system." },
      { type: "paragraph", text: "Services may include:" },
      {
        type: "list",
        items: [
          "receiving and processing Transport Requests;",
          "managing Horse Profiles;",
          "reviewing required transport documents;",
          "creating and confirming route plans;",
          "coordinating transport operations;",
          "recording journey milestones and checkpoints;",
          "recording updates on horse condition and welfare;",
          "managing confirmation of completed horse delivery.",
        ],
      },
      { type: "paragraph", text: "Tracking information in the system is recorded based on journey milestones and checkpoints." },
      { type: "paragraph", text: "Tracking is not continuous real-time GPS tracking." },
    ],
  },
  {
    title: "2. Customer Responsibilities",
    blocks: [
      { type: "paragraph", text: "The Customer is responsible for providing complete, accurate, and up-to-date information necessary to process and perform the transport service." },
      { type: "paragraph", text: "Information may include:" },
      {
        type: "list",
        items: [
          "Customer contact information;",
          "horse pickup location;",
          "horse delivery location;",
          "recipient information;",
          "information about each horse;",
          "requested transport date;",
          "transport-related requirements;",
          "other information necessary for the Transport Order.",
        ],
      },
      { type: "paragraph", text: "The Customer must carefully review all information before submitting the Transport Request." },
      { type: "paragraph", text: "A Transport Request can only be edited directly while the Order is in DRAFT status." },
      { type: "paragraph", text: "After submission, editing permissions will be limited according to the Order processing workflow." },
      { type: "paragraph", text: "If the Customer discovers a significant error after the Transport Order has been APPROVED, the Customer must proactively contact Horse Transport System using the official contact information at the end of these terms." },
      { type: "paragraph", text: "The Customer is responsible for the accuracy of the information provided to the system." },
    ],
  },
  {
    title: "3. Horse Information",
    blocks: [
      { type: "paragraph", text: "The Customer must provide accurate information for each horse included in the Transport Order." },
      { type: "paragraph", text: "Horse information may include:" },
      {
        type: "list",
        items: [
          "horse name;",
          "microchip number;",
          "gender;",
          "date of birth or age;",
          "identification information;",
          "vaccination information;",
          "veterinary information;",
          "ownership information;",
          "other information necessary for safe transport.",
        ],
      },
      { type: "paragraph", text: "Existing Horse Profiles may be reused when creating a new Transport Request." },
    ],
  },
  {
    title: "4. Required Documents",
    blocks: [
      { type: "paragraph", text: "Depending on the Transport Order and journey type, the Customer may be required to provide documents such as:" },
      {
        type: "list",
        items: [
          "horse identification documents;",
          "vaccination certificates;",
          "veterinary records;",
          "ownership documents;",
          "quarantine documents;",
          "import or export permits;",
          "other required legal or transport documents.",
        ],
      },
      { type: "paragraph", text: "A document saved in DRAFT status is not considered submitted." },
      { type: "paragraph", text: "A document is only considered submitted after the Customer submits the document and the document begins the review process." },
      { type: "paragraph", text: "The Customer is responsible for ensuring that uploaded documents:" },
      {
        type: "list",
        items: [
          "belong to the correct horse;",
          "contain accurate information;",
          "remain valid when required;",
          "meet the applicable transport requirements.",
        ],
      },
    ],
  },
  {
    title: "5. Initial Transport Request Review",
    blocks: [
      { type: "paragraph", text: "After the Customer submits a Transport Request, the request will be reviewed before proceeding to the quotation stage." },
      { type: "paragraph", text: "The Logistics Manager may reject a Transport Request if the information, requested timing, transport conditions, or other required information is not suitable for processing." },
      { type: "paragraph", text: "When a Transport Request is rejected:" },
      {
        type: "list",
        items: [
          "the system will provide the rejection reason;",
          "the Order changes to REJECTED status;",
          "a rejected Order cannot be edited, reopened, or resubmitted.",
        ],
      },
      { type: "paragraph", text: "If the Customer still wishes to continue using the service, the Customer must create a new Transport Request." },
      { type: "paragraph", text: "Previously created Horse Profiles may still be reused." },
    ],
  },
  {
    title: "6. Requested Transport Date",
    blocks: [
      { type: "paragraph", text: "The Customer should select a transport date that allows sufficient time to prepare and review documents." },
      { type: "paragraph", text: "As standard guidance, the Customer should allow approximately 10 calendar days to complete the preparation and submission of required documents before transport." },
      { type: "paragraph", text: "The actual Document Completion Deadline will be determined during Order processing." },
      { type: "paragraph", text: "If the Customer's requested transport date is too soon and does not allow sufficient time to process documents, the Transport Request may be rejected and a rejection reason will be provided." },
    ],
  },
  {
    title: "7. Quotation",
    blocks: [
      { type: "paragraph", text: "After the Transport Request has been reviewed, the Customer may receive a Quotation." },
      { type: "paragraph", text: "The Quotation may include:" },
      {
        type: "list",
        items: [
          "the estimated total transport cost;",
          "the Deposit amount;",
          "the Remaining Balance;",
          "information related to the service.",
        ],
      },
      { type: "paragraph", text: "The Quotation is prepared based on the information and operational conditions known at the time it is issued." },
      { type: "paragraph", text: "If no unforeseen circumstances arise, the amount stated in the Quotation will be used as the basis for payment." },
      { type: "paragraph", text: "If necessary operational circumstances result in additional costs, Horse Transport System will contact the Customer directly and notify them of the additional cost before continuing where appropriate." },
    ],
  },
  {
    title: "8. Deposit",
    blocks: [
      { type: "paragraph", text: "The standard Deposit is equal to:" },
      { type: "paragraph", text: "10% of the total Quotation value." },
      { type: "paragraph", text: "Example:" },
      { type: "paragraph", text: "If the total Quotation is 500, the Deposit is 50 and the Remaining Balance is 450." },
      { type: "paragraph", text: "Successful Deposit payment is considered confirmation that the Customer wishes to continue using the service according to the issued Quotation." },
      { type: "paragraph", text: "After the Deposit is successfully paid:" },
      {
        type: "list",
        items: [
          "the Deposit is recorded as PAID;",
          "the Transport Order changes to APPROVED;",
          "the Document Phase begins.",
        ],
      },
      { type: "paragraph", text: "A paid Deposit is non-refundable under the current Horse Transport System business flow." },
      { type: "paragraph", text: "Cancellation of an Order after the Deposit has been paid does not automatically change the Deposit from PAID to REFUNDED." },
      { type: "paragraph", text: "Special operational circumstances outside the normal system flow may be discussed and handled directly between Horse Transport System and the Customer." },
    ],
  },
  {
    title: "9. Original Document Completion Deadline",
    blocks: [
      { type: "paragraph", text: "The Customer must submit all required documents before the Original Document Completion Deadline applicable to the Order." },
      { type: "paragraph", text: "At the deadline:" },
      {
        type: "list",
        items: [
          "a required document that has not been uploaded is considered missing;",
          "a required document still in DRAFT status is considered not submitted;",
          "a required document that has not been submitted may cause the Order to be cancelled.",
        ],
      },
      { type: "paragraph", text: "If the Customer submitted the document on time and it remains in PENDING REVIEW status, the Customer will not be considered late solely because the Transport Specialist has not completed the review." },
      { type: "paragraph", text: "The Customer will not be disadvantaged by a delay in the review process after fulfilling the obligation to submit on time." },
    ],
  },
  {
    title: "10. Document Review",
    blocks: [
      { type: "paragraph", text: "The Transport Specialist is responsible for reviewing submitted documents." },
      { type: "paragraph", text: "A document may be:" },
      {
        type: "list",
        items: [
          "Approved; or",
          "Rejected with a reason.",
        ],
      },
      { type: "paragraph", text: "If a document does not meet the requirements, the Transport Specialist must provide a rejection reason so the Customer knows what must be corrected or supplemented." },
      { type: "paragraph", text: "Horse Transport System does not automatically determine whether the Customer has engaged in fraudulent conduct." },
      { type: "paragraph", text: "Documents containing errors or failing to meet transport requirements will be handled through the Reject and Correction process." },
    ],
  },
  {
    title: "11. First Document Correction",
    blocks: [
      { type: "paragraph", text: "When a required document is rejected for the first time:" },
      {
        type: "list",
        items: [
          "the Customer will see the rejection reason;",
          "the Customer may upload a corrected or replacement version;",
          "the system provides a Correction Deadline.",
        ],
      },
      { type: "paragraph", text: "The Correction Deadline ensures the Customer has at least 24 hours from the time the document is rejected, while also taking into account the Original Document Completion Deadline applicable to the Order." },
      { type: "paragraph", text: "If the Customer submits the corrected version before the Correction Deadline, the document will return to the review process." },
      { type: "paragraph", text: "If the Customer submits the correction on time but the Transport Specialist reviews it only after the Correction Deadline, the Customer will not be considered late." },
    ],
  },
  {
    title: "12. Second and Final Document Correction",
    blocks: [
      { type: "paragraph", text: "If the corrected version still does not meet the requirements, the Transport Specialist may reject the document a second time and must provide a new rejection reason." },
      { type: "paragraph", text: "The Customer will receive a second and final Correction Deadline, with at least another 24 hours to make the correction." },
      { type: "paragraph", text: "Each required document is allowed a maximum of 2 correction opportunities after rejection." },
      { type: "paragraph", text: "After the second rejection, the next corrected version is the Customer's final opportunity to meet the document requirements." },
      { type: "paragraph", text: "If the document still does not meet the requirements after the second correction opportunity:" },
      {
        type: "list",
        items: [
          "a third Correction Deadline will not be created;",
          "no additional correction round will be opened;",
          "the Transport Order will be CANCELLED.",
        ],
      },
      { type: "paragraph", text: "If the Customer does not submit the corrected version before the Correction Deadline on either the first or second occasion, the Transport Order will also be CANCELLED." },
      { type: "paragraph", text: "The Deposit recorded as PAID remains non-refundable under the current business flow." },
    ],
  },
  {
    title: "13. Final Document Confirmation",
    blocks: [
      { type: "paragraph", text: "When all mandatory documents for all Horses in the Transport Order have been APPROVED, the assigned Transport Specialist may perform Final Confirmation." },
      { type: "paragraph", text: "After Final Confirmation:" },
      {
        type: "list",
        items: [
          "the Document Phase is locked;",
          "documents can no longer be changed through the standard Customer flow;",
          "the Order becomes eligible to proceed to Remaining Balance payment.",
        ],
      },
    ],
  },
  {
    title: "14. Remaining Balance",
    blocks: [
      { type: "paragraph", text: "After Final Document Confirmation, the Customer must complete payment of the Remaining Balance before the Order proceeds to Route Planning." },
      { type: "paragraph", text: "The standard Remaining Balance is equal to:" },
      { type: "paragraph", text: "90% of the original total Quotation value, excluding any separately communicated additional costs, if applicable." },
      { type: "paragraph", text: "The current service does not apply a separate automatic deadline for Remaining Balance payment." },
      { type: "paragraph", text: "Until the Remaining Balance is successfully paid, the Order will not proceed to the normal Route Planning stage." },
    ],
  },
  {
    title: "15. Customer Cancellation",
    blocks: [
      { type: "paragraph", text: "The Customer may actively cancel a Transport Order only when the Order is at a stage where the system permits cancellation before Approval." },
      { type: "paragraph", text: "After the Transport Order has changed to APPROVED, the Customer cannot directly cancel or edit the Order through the standard Customer interface." },
      { type: "paragraph", text: "If a significant issue is discovered after Approval, the Customer should contact Horse Transport System directly for assistance." },
      { type: "paragraph", text: "The system may cancel an Order if the Customer does not complete mandatory obligations, including:" },
      {
        type: "list",
        items: [
          "failing to submit required documents before the Original Document Completion Deadline;",
          "failing to submit a corrected version before the Correction Deadline;",
          "documents continuing to fail the requirements after all permitted correction opportunities have been used.",
        ],
      },
      { type: "paragraph", text: "The Deposit recorded as PAID remains non-refundable under the current business flow." },
    ],
  },
  {
    title: "16. Route Planning",
    blocks: [
      { type: "paragraph", text: "Route Planning is prepared by the personnel responsible for transport planning and is reviewed according to the internal operational process." },
      { type: "paragraph", text: "The Customer is not required to create or confirm the Route Plan." },
      { type: "paragraph", text: "The purpose of the Route Plan is to organize the necessary transport legs so the Horse is collected from the agreed location and delivered to the destination stated in the Transport Order." },
    ],
  },
  {
    title: "17. Schedule and Route Changes",
    blocks: [
      { type: "paragraph", text: "Departure times, arrival times, routes, transfer points, stops, or other transport arrangements may need to change due to factors such as:" },
      {
        type: "list",
        items: [
          "Horse safety;",
          "Horse welfare;",
          "weather conditions;",
          "legal or quarantine requirements;",
          "road or airport conditions;",
          "transport vehicle availability;",
          "operational restrictions;",
          "force majeure or other transport circumstances.",
        ],
      },
      { type: "paragraph", text: "The Customer is not required to confirm routine route decisions through the system." },
      { type: "paragraph", text: "If there is a significant operational change, Horse Transport System may contact the Customer directly when necessary." },
      { type: "paragraph", text: "If a change results in necessary additional costs, the Customer will be notified directly." },
    ],
  },
  {
    title: "18. Horse Welfare",
    blocks: [
      { type: "paragraph", text: "Horse safety and welfare are important throughout the transport process." },
      { type: "paragraph", text: "The Customer is responsible for providing relevant health information that may affect the Horse's ability to be transported safely." },
      { type: "paragraph", text: "Transport personnel may record Welfare Updates and related images during the journey." },
      { type: "paragraph", text: "This information may be retained as part of the Transport Order data." },
    ],
  },
  {
    title: "19. Health or Veterinary Emergencies",
    blocks: [
      { type: "paragraph", text: "If a Horse experiences a health issue or welfare-related emergency during transport, Horse Transport System will use the contact information provided by the Customer to communicate and coordinate an appropriate response." },
      { type: "paragraph", text: "The current service does not automatically establish:" },
      {
        type: "list",
        items: [
          "a Horse insurance policy;",
          "a fixed limitation of legal liability;",
          "automatic allocation of all veterinary costs;",
          "automatic compensation rules for Horse injury or illness.",
        ],
      },
      { type: "paragraph", text: "Special circumstances will be discussed and handled directly with the Customer when necessary." },
    ],
  },
  {
    title: "20. Tracking",
    blocks: [
      { type: "paragraph", text: "Horse Transport System tracking is based on journey milestones and checkpoints." },
      { type: "paragraph", text: "Milestones may include:" },
      {
        type: "list",
        items: [
          "journey started;",
          "checkpoint reached;",
          "Welfare Update recorded;",
          "Route Leg completed;",
          "final destination reached;",
          "Horse delivery completed.",
        ],
      },
      { type: "paragraph", text: "Tracking is not continuous real-time GPS tracking." },
    ],
  },
  {
    title: "21. Notifications",
    blocks: [
      { type: "paragraph", text: "Horse Transport System may provide notifications related to important Order events, including:" },
      {
        type: "list",
        items: [
          "payment result;",
          "Order cancellation due to the Document Deadline;",
          "Order cancellation due to the Correction Deadline;",
          "journey started;",
          "checkpoint reached;",
          "Welfare Update;",
          "Route Leg completed;",
          "final destination reached;",
          "delivery completed.",
        ],
      },
      { type: "paragraph", text: "The Customer is responsible for checking important information and notifications related to the Order throughout the transport process." },
    ],
  },
  {
    title: "22. Proof of Delivery",
    blocks: [
      { type: "paragraph", text: "The final stage of the transport process requires Proof of Delivery or another appropriate form of handover confirmation before the Transport Order changes to DELIVERED status." },
      { type: "paragraph", text: "Proof of Delivery is recorded by assigned transport personnel according to the handover process." },
      { type: "paragraph", text: "In the current version of the service, the Customer is not required to:" },
      {
        type: "list",
        items: [
          "log in to the system at the time of delivery;",
          "enter an OTP;",
          "sign electronically directly in the system;",
        ],
      },
      { type: "paragraph", text: "unless this functionality is added in the future." },
    ],
  },
  {
    title: "23. Collection of Personal Information",
    blocks: [
      { type: "paragraph", text: "Horse Transport System may collect information that is necessary and reasonable to provide and operate the transport service." },
      { type: "paragraph", text: "Information may include:" },
      {
        type: "list",
        items: [
          "account information;",
          "Customer contact information;",
          "Transport Request information;",
          "Horse information;",
          "transport documents;",
          "payment-related information;",
          "route and handover information;",
          "Welfare Records;",
          "Proof of Delivery.",
        ],
      },
    ],
  },
  {
    title: "24. Use of Information",
    blocks: [
      { type: "paragraph", text: "Collected information may be used to:" },
      {
        type: "list",
        items: [
          "create and manage Customer accounts;",
          "process Transport Requests;",
          "contact the Customer;",
          "review required documents;",
          "process payments;",
          "coordinate transport;",
          "manage routes and handover information;",
          "send service-related notifications;",
          "maintain service records;",
          "support and improve system operations.",
        ],
      },
    ],
  },
  {
    title: "25. Service Providers and Third Parties",
    blocks: [
      { type: "paragraph", text: "Horse Transport System may use third-party technical service providers necessary to operate the system." },
      { type: "paragraph", text: "Services may include:" },
      {
        type: "list",
        items: [
          "Stripe for payment processing;",
          "Cloudinary for storing transport documents, Welfare Media, and Proof of Delivery Media;",
          "database and infrastructure services used to operate Horse Transport System.",
        ],
      },
      { type: "paragraph", text: "Information may be processed by these providers to the reasonable and necessary extent required to provide the corresponding functionality or service." },
      { type: "paragraph", text: "Horse Transport System may also provide information where necessary to comply with appropriate legal requirements or handle safety and emergency situations." },
    ],
  },
  {
    title: "26. Information Security",
    blocks: [
      { type: "paragraph", text: "Horse Transport System applies reasonable measures to protect Customer information from:" },
      {
        type: "list",
        items: [
          "unauthorized access;",
          "misuse;",
          "loss;",
          "inappropriate disclosure.",
        ],
      },
      { type: "paragraph", text: "However, no information system operating on the Internet can guarantee absolute security in every circumstance." },
      { type: "paragraph", text: "The Customer is also responsible for protecting login information and not sharing sensitive account information with unauthorized persons." },
    ],
  },
  {
    title: "27. Information Retention Period",
    blocks: [
      { type: "paragraph", text: "Horse Transport System currently does not apply a fixed automatic retention period to all Customer and Transport Order data." },
      { type: "paragraph", text: "Information may be retained for a reasonable and necessary period to:" },
      {
        type: "list",
        items: [
          "provide the transport service;",
          "maintain Transport Order records;",
          "support operational processes;",
          "fulfill the purpose for which the information was collected;",
          "meet related operational requirements.",
        ],
      },
    ],
  },
  {
    title: "28. Transport Terms and Important Notices",
    blocks: [
      { type: "paragraph", text: "The Customer may be shown the Transport Terms & Important Notices when accessing the Customer Workspace." },
      { type: "paragraph", text: "The Customer may select Don't show again to prevent this general notice from being displayed during future visits in the same browser." },
      { type: "paragraph", text: "However, before paying the Deposit, the applicable Transport Terms and Important Notices will be displayed again." },
      { type: "paragraph", text: "The Customer must confirm:" },
      { type: "paragraph", text: "“I have read and agree to the Transport Terms & Important Notices.”" },
      { type: "paragraph", text: "before continuing to payment." },
    ],
  },
  {
    title: "29. Changes to the Terms",
    blocks: [
      { type: "paragraph", text: "Horse Transport System may update the Terms & Important Notices when:" },
      {
        type: "list",
        items: [
          "the service process changes;",
          "system functionality changes;",
          "the transport process changes;",
          "related operational requirements are updated.",
        ],
      },
      { type: "paragraph", text: "When significant changes occur, the new version of the Terms may be displayed again for the Customer to review before continuing to use the service." },
      { type: "paragraph", text: "The Customer should read the current version of the Terms when using the system." },
    ],
  },
  {
    title: "30. Contact Information",
    blocks: [
      { type: "paragraph", text: "If the Customer discovers inaccurate information, needs assistance with a Transport Order, or has questions about documents, schedules, payments, or other service-related matters, please contact:" },
      { type: "paragraph", text: "Horse Transport System" },
      { type: "paragraph", text: "Email: support@horsetransport.demo\nPhone: 028.7300.8899\nAddress: 123 Transport Street, Ho Chi Minh City, Vietnam" },
      { type: "paragraph", text: "The information above is used as the contact information for the current version of Horse Transport System." },
    ],
  },
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
