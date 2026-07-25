# Service Section – Scope, Analysis & Quotation

**Document Version:** 1.0  
**Date:** February 2025  
**Purpose:** Client-facing scope and quotation for the new Service section in the ArcForge CloudArc application.

---

## 1. Executive Summary

This document outlines the scope, deliverables, and investment for introducing a dedicated **Service** section into the ArcForge CloudArc application. The Service section will enable service teams to look up commissioned units by **serial number**, view and manage all related commissioning and service information in one place, and operate through an interface aligned with the existing order-tracking workflow (accordion-based layout with forms).

The implementation includes **new backend APIs**, **database extensions** where required, **a new section and UI**, and **integration with and refinements to the existing order-tracking flow** so that commissioning and service workflows work together end-to-end.

---

## 2. Business Context

- **Current state:** Commissioning and service-related data are captured and viewed within **PO Details** (per purchase order). Service teams need a **serial-number-centric** entry point to quickly access all information for a commissioned unit without navigating via PO.
- **Objective:** Add a **Service** section where users select a **serial number** (from commissioned units in order tracking), and the system fetches and displays **all details** available for that commissioning (product, dispatch, PO context, pre-commissioning, commissioning, warranty, and any new service-specific data). The section will follow the **same structural pattern** as order tracking: accordion panels with tables and forms for a consistent user experience.
- **Reference:** Scope and pricing are aligned with the investment level of the existing order-tracking application (**₹1,50,000**).

---

## 3. Scope of Work

### 3.1 New Service Section (UI & Navigation)

| Deliverable | Description |
|-------------|-------------|
| **New section & route** | A dedicated Service section in the application with its own route and navigation entry (e.g. “Service” / “Service Requests”). |
| **Serial number lookup** | Search/select by serial number to identify commissioned units. Results driven by existing commissioning data; UX may include typeahead, filters, and clear display of product/PO context. |
| **Accordion-based layout** | Same structural pattern as order tracking: **Collapse/accordion** with multiple panels, each with relevant tables and actions. Panels and fields will reflect the OSG Service Request Tracker spec (e.g. commissioning summary, service requests, documents, history). |
| **Forms & actions** | Form modals and inline actions within the accordion for viewing, creating, and updating service-related data (e.g. service requests, status updates, documents) as per the agreed workflow. |
| **Permissions** | Access control for the Service section (read/update as applicable), consistent with the existing role and permission model. |

### 3.2 Backend & APIs

| Deliverable | Description |
|-------------|-------------|
| **Get commissioning by serial number** | New API(s) to fetch full commissioning (and related) details for a given serial number: service record, linked dispatch, PO summary, product, and all pre-commissioning, commissioning, and warranty fields. This is the core integration point for the Service section. |
| **Serial number listing/search** | API support for listing or searching serial numbers (e.g. for dropdown/typeahead) with optional filters (e.g. status, product, date range) so users can quickly find the right unit. |
| **New entities (if required by spec)** | If the Service Request Tracker spec introduces new concepts (e.g. “Service Request” with its own lifecycle), the scope includes: **new tables/columns**, **migrations**, and **full CRUD APIs** (list, create, update, delete) with proper validation and audit. |
| **Existing API extensions** | Any extensions to existing service/commissioning APIs needed to support the Service section (e.g. response shape, filters, or new query parameters). |

### 3.3 Integration with Existing Order-Tracking Flow

| Deliverable | Description |
|-------------|-------------|
| **Flow alignment** | Ensure the **existing order-tracking flow** (PO → Dispatch → Delivery → Pre-Commissioning → Commissioning → Warranty) aligns with how the Service section consumes and updates data. This may include: consistent status handling, serial number visibility, and assignment rules. |
| **Refinements to existing flow** | Where the **service workflow** requires it, the scope includes **refinements to existing screens, APIs, or behaviour** (e.g. commissioning status updates, serial number display, assignments, or validations) so that data remains consistent between PO-centric and serial-centric views. |
| **Data consistency** | Same source of truth for commissioning and service data; no duplicate or conflicting flows. |

### 3.4 Database

| Deliverable | Description |
|-------------|-------------|
| **Schema extensions** | New tables and/or columns **only as required** by the Service section and the agreed spec (e.g. Service Request entity, status history, or document links). Existing core schema (PO, Dispatch, Service lifecycle) remains the foundation. |
| **Migrations** | Proper migrations for any new or changed tables/columns, with rollback consideration. |

### 3.5 Documentation & Handover

| Deliverable | Description |
|-------------|-------------|
| **API documentation** | Description of new and changed endpoints, request/response shapes, and usage for the Service section. |
| **Permission updates** | Updates to permission/role documentation if new permissions or roles are introduced for the Service section. |
| **User/operational guidance** | Brief description of the Service section flow (serial lookup → accordion → forms) for training or support, if required. |

---

## 4. Out of Scope (Unless Agreed Separately)

- Changes to **core PO creation or approval** workflow beyond what is needed for service/commissioning alignment.
- **New modules** unrelated to the Service section (e.g. separate CRM or inventory).
- **Infrastructure or hosting** changes beyond what is already in place for the application.
- **Third-party integrations** (e.g. ERP, external ticketing) unless explicitly included in a separate SOW.

---

## 5. Assumptions & Dependencies

- **Spec:** Final screens, fields, and workflow will be confirmed from the **OSG Service Request Tracker** specification (e.g. from `### OSG_Service_Request_Tracker_R0_03.08.2025.xlsx` or an agreed export). Any additional entities (e.g. Service Request) will be scoped once the spec is frozen.
- **Serial number:** Uniqueness and business rules (e.g. one serial across multiple POs) will be agreed so that “get by serial” and list behaviour are well-defined.
- **Access:** Permissions for the Service section will follow the existing role/permission model unless a separate access model is agreed.
- **Timeline:** Schedule and milestones to be agreed separately; this document defines scope and investment only.

---

## 6. Investment (Budget)

| Item | Amount (INR) |
|------|--------------|
| **Service section – full scope** | **₹1,50,000** |
| **Total** | **₹1,50,000** (Rupees One Lakh Fifty Thousand only) |

**What this covers:**

- **New Service section:** Route, navigation, serial-number lookup, accordion layout, and all forms/actions as per the agreed spec.
- **New APIs:** Get commissioning by serial number, serial listing/search, and full CRUD for any new entities (e.g. Service Request) introduced by the spec.
- **Database:** New tables/columns and migrations required for the Service section only.
- **Integration & flow refinements:** Alignment of existing order-tracking flow with the service workflow and any agreed refinements to existing screens or APIs to support consistency and a unified experience.
- **Documentation:** API and permission docs, and brief user/flow description as outlined above.

**Payment terms and schedule** to be as per the commercial agreement between the parties.

---

## 7. Why This Investment Is Justified

1. **Dedicated service experience:** A full section built around serial number and service workflow, not a side feature, with its own navigation, screens, and APIs.
2. **End-to-end integration:** New APIs and possible extensions to existing ones so that commissioning data is reliably available by serial number and stays in sync with PO-centric flow.
3. **Consistent UX:** Same accordion-and-forms structure as order tracking reduces training and errors.
4. **Extensibility:** Room for new entities (e.g. Service Request) and fields as the spec is finalised, with proper DB and API design.
5. **Flow alignment:** Explicit scope for refining the existing flow based on service needs, so the system supports both order-centric and service-centric usage without inconsistency.

---

## 8. Next Steps

1. **Finalise spec:** Confirm screens, fields, and workflow from the Service Request Tracker document (and any new entities).
2. **Sign-off:** Client sign-off on this scope and budget.
3. **Execution:** Implementation in phases: APIs and DB (if any) → Service section UI (route, serial lookup, accordion, forms) → integration and refinements to existing flow → documentation and handover.

---

*This document is intended for client review and commercial discussion. Technical implementation details will follow the agreed scope and the project’s existing architecture and standards.*
