-- Horse Transport System - approved MVP schema.
-- Source: docs/erd/erd.dbml


CREATE TYPE user_role AS ENUM (
    'CUSTOMER',
    'LOGISTICS_MANAGER',
    'TRANSPORT_SPECIALIST',
    'FLEET_ROUTE_COORDINATOR',
    'DRIVER',
    'ESCORT'
);

CREATE TYPE user_status AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE transport_mode AS ENUM ('ROAD', 'AIR', 'COMBINED');
CREATE TYPE order_status AS ENUM (
    'DRAFT',
    'SUBMITTED',
    'QUOTATION_SENT',
    'APPROVED',
    'READY_TO_SHIP',
    'IN_PROGRESS',
    'DELIVERED',
    'REJECTED',
    'CANCELLED'
);
CREATE TYPE order_horse_document_status AS ENUM (
    'INCOMPLETE',
    'UNDER_REVIEW',
    'NEEDS_REVISION',
    'ELIGIBLE_FOR_EXPORT'
);
CREATE TYPE order_staff_role AS ENUM ('TRANSPORT_SPECIALIST', 'FLEET_ROUTE_COORDINATOR');
CREATE TYPE quotation_status AS ENUM ('DRAFT', 'SENT');
CREATE TYPE payment_type AS ENUM ('DEPOSIT', 'REMAINING_BALANCE');
CREATE TYPE payment_status AS ENUM ('PENDING', 'PAID', 'REFUNDED');
CREATE TYPE document_type AS ENUM (
    'HORSE_PASSPORT_OR_IDENTIFICATION',
    'VACCINATION_CERTIFICATE',
    'VETERINARY_HEALTH_CERTIFICATE',
    'OWNERSHIP_CERTIFICATE',
    'EXPORT_IMPORT_PERMIT'
);
CREATE TYPE document_version_status AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED');
CREATE TYPE vehicle_status AS ENUM ('AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'INACTIVE');
CREATE TYPE route_plan_status AS ENUM ('DRAFT', 'PENDING_LM_REVIEW', 'RETURNED', 'APPROVED');
CREATE TYPE route_plan_review_decision AS ENUM ('PENDING', 'CONFIRMED', 'RETURNED');
CREATE TYPE route_leg_type AS ENUM ('ROAD', 'AIR');
CREATE TYPE route_leg_status AS ENUM ('PLANNED', 'READY', 'IN_PROGRESS', 'COMPLETED');
CREATE TYPE execution_status AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'DESTINATION', 'COMPLETED');
CREATE TYPE checkpoint_type AS ENUM ('REST_STOP', 'BORDER', 'QUARANTINE', 'OTHER');
CREATE TYPE welfare_event_type AS ENUM ('CHECKPOINT', 'FINAL_DESTINATION');
CREATE TYPE notification_type AS ENUM (
    'TRIP_STARTED',
    'CHECKPOINT_REACHED',
    'WELFARE_UPDATED',
    'ROUTE_LEG_COMPLETED',
    'FINAL_DESTINATION_REACHED',
    'ORDER_DELIVERED',
    'PAYMENT_RESULT',
    'REFUND_RESULT'
);
CREATE TYPE audit_actor_kind AS ENUM ('USER', 'SYSTEM');
CREATE TYPE audit_entity_type AS ENUM (
    'TRANSPORT_ORDER',
    'TRANSPORT_ORDER_HORSE',
    'HORSE_DOCUMENT_VERSION',
    'ROUTE_LEG',
    'QUOTATION'
);

CREATE TABLE users (
    id uuid PRIMARY KEY,
    full_name varchar(120) NOT NULL,
    email varchar(150) NOT NULL UNIQUE,
    phone varchar(30),
    password_hash varchar(255) NOT NULL,
    role user_role NOT NULL,
    status user_status NOT NULL DEFAULT 'ACTIVE',
    created_at timestamp NOT NULL,
    updated_at timestamp
);

CREATE TABLE horses (
    id uuid PRIMARY KEY,
    customer_id uuid NOT NULL REFERENCES users (id),
    name varchar(120) NOT NULL,
    passport_number varchar(100),
    microchip_id varchar(50) NOT NULL UNIQUE,
    breed varchar(100),
    sex varchar(20),
    date_of_birth date,
    notes text,
    created_at timestamp NOT NULL,
    updated_at timestamp
);

CREATE INDEX idx_horses_customer_id ON horses (customer_id);
CREATE INDEX idx_horses_passport_number ON horses (passport_number);

CREATE TABLE transport_orders (
    id uuid PRIMARY KEY,
    order_code varchar(30) NOT NULL UNIQUE,
    customer_id uuid NOT NULL REFERENCES users (id),
    origin_address varchar(255),
    origin_country varchar(100),
    destination_address varchar(255),
    destination_country varchar(100),
    requested_departure_at timestamp,
    transport_mode transport_mode,
    special_requirements text,
    recipient_name varchar(150),
    recipient_phone varchar(30),
    recipient_email varchar(150),
    document_completion_deadline_at timestamp,
    document_deadline_set_by uuid REFERENCES users (id),
    document_deadline_set_at timestamp,
    documents_final_confirmed_by uuid REFERENCES users (id),
    documents_final_confirmed_at timestamp,
    documents_locked_at timestamp,
    status order_status NOT NULL DEFAULT 'DRAFT',
    rejection_reason text,
    cancellation_reason text,
    cancelled_at timestamp,
    approved_at timestamp,
    ready_to_ship_at timestamp,
    journey_started_at timestamp,
    delivered_at timestamp,
    created_at timestamp NOT NULL,
    updated_at timestamp
);

CREATE INDEX idx_transport_orders_customer_id ON transport_orders (customer_id);
CREATE INDEX idx_transport_orders_status ON transport_orders (status);
CREATE INDEX idx_transport_orders_requested_departure_at ON transport_orders (requested_departure_at);
CREATE INDEX idx_transport_orders_document_deadline ON transport_orders (document_completion_deadline_at);

CREATE TABLE transport_order_horses (
    id uuid PRIMARY KEY,
    transport_order_id uuid NOT NULL REFERENCES transport_orders (id),
    horse_id uuid NOT NULL REFERENCES horses (id),
    document_status order_horse_document_status NOT NULL DEFAULT 'INCOMPLETE',
    travel_notes text,
    created_at timestamp NOT NULL,
    updated_at timestamp,
    UNIQUE (transport_order_id, horse_id)
);

CREATE INDEX idx_transport_order_horses_order_id ON transport_order_horses (transport_order_id);
CREATE INDEX idx_transport_order_horses_horse_id ON transport_order_horses (horse_id);
CREATE INDEX idx_transport_order_horses_document_status ON transport_order_horses (document_status);

CREATE TABLE order_staff_assignments (
    id uuid PRIMARY KEY,
    transport_order_id uuid NOT NULL REFERENCES transport_orders (id),
    assignment_role order_staff_role NOT NULL,
    user_id uuid NOT NULL REFERENCES users (id),
    assigned_by uuid NOT NULL REFERENCES users (id),
    assigned_at timestamp NOT NULL,
    UNIQUE (transport_order_id, assignment_role)
);

CREATE INDEX idx_order_staff_assignments_user_id ON order_staff_assignments (user_id);

CREATE TABLE quotations (
    id uuid PRIMARY KEY,
    transport_order_id uuid NOT NULL UNIQUE REFERENCES transport_orders (id),
    total_amount numeric(12,2),
    deposit_amount numeric(12,2),
    remaining_amount numeric(12,2),
    currency varchar(10) NOT NULL DEFAULT 'USD',
    notes text,
    status quotation_status NOT NULL DEFAULT 'DRAFT',
    created_by uuid NOT NULL REFERENCES users (id),
    sent_at timestamp,
    created_at timestamp NOT NULL,
    updated_at timestamp,
    CONSTRAINT quotation_total_positive CHECK (total_amount > 0),
    CONSTRAINT quotation_deposit_valid CHECK (deposit_amount > 0 AND deposit_amount < total_amount),
    CONSTRAINT quotation_remaining_matches CHECK (remaining_amount = total_amount - deposit_amount)
);

CREATE INDEX idx_quotations_status ON quotations (status);

CREATE TABLE quotation_line_items (
    id uuid PRIMARY KEY,
    quotation_id uuid NOT NULL REFERENCES quotations (id),
    sequence_no integer NOT NULL,
    description varchar(255) NOT NULL,
    amount numeric(12,2) NOT NULL,
    created_at timestamp NOT NULL,
    updated_at timestamp,
    UNIQUE (quotation_id, sequence_no),
    CONSTRAINT quotation_item_sequence_positive CHECK (sequence_no > 0)
);

CREATE INDEX idx_quotation_line_items_quotation_id ON quotation_line_items (quotation_id);

CREATE TABLE payments (
    id uuid PRIMARY KEY,
    transport_order_id uuid NOT NULL REFERENCES transport_orders (id),
    payment_type payment_type NOT NULL,
    amount numeric(12,2) NOT NULL,
    currency varchar(10) NOT NULL,
    status payment_status NOT NULL DEFAULT 'PENDING',
    paid_at timestamp,
    refunded_at timestamp,
    created_at timestamp NOT NULL,
    updated_at timestamp,
    UNIQUE (transport_order_id, payment_type),
    CONSTRAINT payment_amount_positive CHECK (amount > 0)
);

CREATE INDEX idx_payments_order_status ON payments (transport_order_id, status);

CREATE TABLE payment_attempts (
    id uuid PRIMARY KEY,
    payment_id uuid NOT NULL REFERENCES payments (id),
    attempt_no integer NOT NULL,
    provider_name varchar(30) NOT NULL DEFAULT 'STRIPE',
    provider_payment_intent_id varchar(255) UNIQUE,
    provider_checkout_session_id varchar(255) UNIQUE,
    idempotency_key varchar(255) NOT NULL UNIQUE,
    provider_status varchar(80),
    initiated_at timestamp NOT NULL,
    succeeded_at timestamp,
    updated_at timestamp,
    UNIQUE (payment_id, attempt_no),
    CONSTRAINT payment_attempt_number_positive CHECK (attempt_no > 0)
);

CREATE INDEX idx_payment_attempts_payment_id ON payment_attempts (payment_id);

CREATE TABLE payment_provider_events (
    id uuid PRIMARY KEY,
    payment_id uuid NOT NULL REFERENCES payments (id),
    payment_attempt_id uuid REFERENCES payment_attempts (id),
    provider_event_id varchar(255) NOT NULL UNIQUE,
    provider_event_type varchar(120) NOT NULL,
    received_at timestamp NOT NULL,
    processed_at timestamp,
    processing_error text
);

CREATE INDEX idx_payment_provider_events_payment_id ON payment_provider_events (payment_id);
CREATE INDEX idx_payment_provider_events_attempt_id ON payment_provider_events (payment_attempt_id);
CREATE INDEX idx_payment_provider_events_processed_at ON payment_provider_events (processed_at);

CREATE TABLE deposit_refunds (
    id uuid PRIMARY KEY,
    payment_id uuid NOT NULL UNIQUE REFERENCES payments (id),
    provider_refund_id varchar(255) UNIQUE,
    idempotency_key varchar(255) NOT NULL UNIQUE,
    provider_status varchar(80),
    requested_at timestamp NOT NULL,
    completed_at timestamp,
    processing_error text
);

CREATE TABLE horse_documents (
    id uuid PRIMARY KEY,
    transport_order_horse_id uuid NOT NULL REFERENCES transport_order_horses (id),
    document_type document_type NOT NULL,
    created_at timestamp NOT NULL,
    updated_at timestamp,
    UNIQUE (transport_order_horse_id, document_type)
);

CREATE INDEX idx_horse_documents_order_horse_id ON horse_documents (transport_order_horse_id);

CREATE TABLE horse_document_versions (
    id uuid PRIMARY KEY,
    horse_document_id uuid NOT NULL REFERENCES horse_documents (id),
    version_no integer NOT NULL,
    file_url varchar(500) NOT NULL,
    expiry_date date,
    status document_version_status NOT NULL DEFAULT 'DRAFT',
    is_current boolean NOT NULL DEFAULT true,
    uploaded_by uuid NOT NULL REFERENCES users (id),
    uploaded_at timestamp NOT NULL,
    submitted_at timestamp,
    reviewed_by uuid REFERENCES users (id),
    reviewed_at timestamp,
    rejection_reason text,
    created_at timestamp NOT NULL,
    updated_at timestamp,
    UNIQUE (horse_document_id, version_no),
    CONSTRAINT document_version_number_positive CHECK (version_no > 0),
    CONSTRAINT document_rejection_reason_required CHECK (
        status <> 'REJECTED' OR (rejection_reason IS NOT NULL AND length(trim(rejection_reason)) > 0)
    ),
    CONSTRAINT document_review_metadata_required CHECK (
        status NOT IN ('APPROVED', 'REJECTED') OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
    )
);

CREATE INDEX idx_horse_document_versions_document_id ON horse_document_versions (horse_document_id);
CREATE INDEX idx_horse_document_versions_status ON horse_document_versions (status);
CREATE INDEX idx_horse_document_versions_is_current ON horse_document_versions (is_current);
CREATE UNIQUE INDEX uq_horse_document_versions_current
    ON horse_document_versions (horse_document_id)
    WHERE is_current = true;

CREATE TABLE vehicles (
    id uuid PRIMARY KEY,
    plate_number varchar(50) NOT NULL UNIQUE,
    vehicle_name varchar(120),
    vehicle_type varchar(100),
    horse_capacity integer NOT NULL,
    status vehicle_status NOT NULL DEFAULT 'AVAILABLE',
    notes text,
    created_at timestamp NOT NULL,
    updated_at timestamp,
    CONSTRAINT vehicle_capacity_positive CHECK (horse_capacity > 0)
);

CREATE TABLE route_plans (
    id uuid PRIMARY KEY,
    transport_order_id uuid NOT NULL UNIQUE REFERENCES transport_orders (id),
    status route_plan_status NOT NULL DEFAULT 'DRAFT',
    created_by uuid NOT NULL REFERENCES users (id),
    created_at timestamp NOT NULL,
    updated_at timestamp,
    locked_at timestamp,
    approved_at timestamp
);

CREATE TABLE route_plan_reviews (
    id uuid PRIMARY KEY,
    route_plan_id uuid NOT NULL REFERENCES route_plans (id),
    submission_no integer NOT NULL,
    decision route_plan_review_decision NOT NULL DEFAULT 'PENDING',
    submitted_by uuid NOT NULL REFERENCES users (id),
    submitted_at timestamp NOT NULL,
    decided_by uuid REFERENCES users (id),
    decided_at timestamp,
    return_reason text,
    UNIQUE (route_plan_id, submission_no),
    CONSTRAINT route_review_submission_positive CHECK (submission_no > 0),
    CONSTRAINT route_return_reason_required CHECK (
        decision <> 'RETURNED' OR (return_reason IS NOT NULL AND length(trim(return_reason)) > 0)
    ),
    CONSTRAINT route_review_decision_metadata_required CHECK (
        decision = 'PENDING' OR (decided_by IS NOT NULL AND decided_at IS NOT NULL)
    )
);

CREATE INDEX idx_route_plan_reviews_plan_decision ON route_plan_reviews (route_plan_id, decision);

CREATE TABLE route_legs (
    id uuid PRIMARY KEY,
    route_plan_id uuid NOT NULL REFERENCES route_plans (id),
    sequence_no integer NOT NULL,
    leg_type route_leg_type NOT NULL,
    origin varchar(255) NOT NULL,
    destination varchar(255) NOT NULL,
    planned_departure_at timestamp NOT NULL,
    planned_arrival_at timestamp NOT NULL,
    air_provider_name varchar(150),
    air_reference varchar(100),
    air_capacity_horses integer,
    equipment_details text,
    status route_leg_status NOT NULL DEFAULT 'PLANNED',
    notes text,
    started_at timestamp,
    completed_at timestamp,
    created_at timestamp NOT NULL,
    updated_at timestamp,
    UNIQUE (route_plan_id, sequence_no),
    CONSTRAINT route_leg_sequence_positive CHECK (sequence_no > 0),
    CONSTRAINT route_leg_time_order CHECK (planned_departure_at < planned_arrival_at),
    CONSTRAINT route_leg_type_fields CHECK (
        (leg_type = 'AIR' AND air_provider_name IS NOT NULL AND air_reference IS NOT NULL AND air_capacity_horses > 0)
        OR
        (leg_type = 'ROAD' AND air_provider_name IS NULL AND air_reference IS NULL AND air_capacity_horses IS NULL)
    )
);

CREATE INDEX idx_route_legs_route_plan_id ON route_legs (route_plan_id);
CREATE INDEX idx_route_legs_status ON route_legs (status);

CREATE TABLE road_leg_vehicles (
    id uuid PRIMARY KEY,
    route_leg_id uuid NOT NULL REFERENCES route_legs (id),
    vehicle_id uuid NOT NULL REFERENCES vehicles (id),
    assigned_at timestamp NOT NULL,
    UNIQUE (route_leg_id, vehicle_id),
    UNIQUE (id, route_leg_id)
);

CREATE INDEX idx_road_leg_vehicles_route_leg_id ON road_leg_vehicles (route_leg_id);
CREATE INDEX idx_road_leg_vehicles_vehicle_id ON road_leg_vehicles (vehicle_id);

CREATE TABLE road_leg_vehicle_horses (
    id uuid PRIMARY KEY,
    route_leg_id uuid NOT NULL,
    road_leg_vehicle_id uuid NOT NULL,
    transport_order_horse_id uuid NOT NULL REFERENCES transport_order_horses (id),
    assigned_at timestamp NOT NULL,
    UNIQUE (road_leg_vehicle_id, transport_order_horse_id),
    UNIQUE (route_leg_id, transport_order_horse_id),
    FOREIGN KEY (road_leg_vehicle_id, route_leg_id)
        REFERENCES road_leg_vehicles (id, route_leg_id)
);

CREATE INDEX idx_road_leg_vehicle_horses_vehicle_id ON road_leg_vehicle_horses (road_leg_vehicle_id);
CREATE INDEX idx_road_leg_vehicle_horses_order_horse_id ON road_leg_vehicle_horses (transport_order_horse_id);

CREATE TABLE road_vehicle_executions (
    id uuid PRIMARY KEY,
    road_leg_vehicle_id uuid NOT NULL UNIQUE REFERENCES road_leg_vehicles (id),
    driver_id uuid NOT NULL REFERENCES users (id),
    escort_id uuid NOT NULL REFERENCES users (id),
    status execution_status NOT NULL DEFAULT 'NOT_STARTED',
    assigned_at timestamp NOT NULL,
    started_at timestamp,
    destination_arrived_at timestamp,
    completed_at timestamp
);

CREATE INDEX idx_road_vehicle_executions_driver_id ON road_vehicle_executions (driver_id);
CREATE INDEX idx_road_vehicle_executions_escort_id ON road_vehicle_executions (escort_id);
CREATE INDEX idx_road_vehicle_executions_status ON road_vehicle_executions (status);

CREATE TABLE air_leg_executions (
    id uuid PRIMARY KEY,
    route_leg_id uuid NOT NULL UNIQUE REFERENCES route_legs (id),
    escort_id uuid NOT NULL REFERENCES users (id),
    status execution_status NOT NULL DEFAULT 'NOT_STARTED',
    assigned_at timestamp NOT NULL,
    started_at timestamp,
    destination_arrived_at timestamp,
    completed_at timestamp
);

CREATE INDEX idx_air_leg_executions_escort_id ON air_leg_executions (escort_id);
CREATE INDEX idx_air_leg_executions_status ON air_leg_executions (status);

CREATE TABLE checkpoints (
    id uuid PRIMARY KEY,
    route_leg_id uuid NOT NULL REFERENCES route_legs (id),
    sequence_no integer NOT NULL,
    name varchar(150) NOT NULL,
    checkpoint_type checkpoint_type NOT NULL,
    country_code varchar(10),
    minimum_required_stop_minutes integer,
    planned_stop_duration_minutes integer,
    notes text,
    created_at timestamp NOT NULL,
    updated_at timestamp,
    UNIQUE (route_leg_id, sequence_no),
    CONSTRAINT checkpoint_sequence_positive CHECK (sequence_no > 0),
    CONSTRAINT rest_stop_duration_valid CHECK (
        checkpoint_type <> 'REST_STOP'
        OR (
            minimum_required_stop_minutes IS NOT NULL
            AND minimum_required_stop_minutes >= 0
            AND planned_stop_duration_minutes IS NOT NULL
            AND planned_stop_duration_minutes >= minimum_required_stop_minutes
        )
    )
);

CREATE INDEX idx_checkpoints_route_leg_id ON checkpoints (route_leg_id);

CREATE TABLE vehicle_checkpoint_arrivals (
    id uuid PRIMARY KEY,
    road_vehicle_execution_id uuid NOT NULL REFERENCES road_vehicle_executions (id),
    checkpoint_id uuid NOT NULL REFERENCES checkpoints (id),
    recorded_by_driver_id uuid NOT NULL REFERENCES users (id),
    arrived_at timestamp NOT NULL,
    UNIQUE (road_vehicle_execution_id, checkpoint_id)
);

CREATE INDEX idx_vehicle_checkpoint_arrivals_checkpoint_id ON vehicle_checkpoint_arrivals (checkpoint_id);
CREATE INDEX idx_vehicle_checkpoint_arrivals_arrived_at ON vehicle_checkpoint_arrivals (arrived_at);

CREATE TABLE welfare_evidence (
    id uuid PRIMARY KEY,
    road_vehicle_execution_id uuid REFERENCES road_vehicle_executions (id),
    air_leg_execution_id uuid REFERENCES air_leg_executions (id),
    checkpoint_id uuid REFERENCES checkpoints (id),
    event_type welfare_event_type NOT NULL,
    photo_url varchar(500) NOT NULL,
    note text NOT NULL,
    recorded_by_escort_id uuid NOT NULL REFERENCES users (id),
    recorded_at timestamp NOT NULL,
    CONSTRAINT welfare_exactly_one_scope CHECK (
        (road_vehicle_execution_id IS NOT NULL AND air_leg_execution_id IS NULL)
        OR
        (road_vehicle_execution_id IS NULL AND air_leg_execution_id IS NOT NULL)
    ),
    CONSTRAINT welfare_event_scope_valid CHECK (
        (event_type = 'CHECKPOINT' AND road_vehicle_execution_id IS NOT NULL AND checkpoint_id IS NOT NULL)
        OR
        (event_type = 'FINAL_DESTINATION' AND checkpoint_id IS NULL)
    ),
    CONSTRAINT welfare_note_required CHECK (length(trim(note)) > 0)
);

CREATE INDEX idx_welfare_evidence_road_execution_id ON welfare_evidence (road_vehicle_execution_id);
CREATE INDEX idx_welfare_evidence_air_execution_id ON welfare_evidence (air_leg_execution_id);
CREATE INDEX idx_welfare_evidence_checkpoint_id ON welfare_evidence (checkpoint_id);
CREATE INDEX idx_welfare_evidence_recorded_at ON welfare_evidence (recorded_at);
CREATE UNIQUE INDEX uq_welfare_evidence_road_checkpoint
    ON welfare_evidence (road_vehicle_execution_id, checkpoint_id)
    WHERE event_type = 'CHECKPOINT';
CREATE UNIQUE INDEX uq_welfare_evidence_road_final
    ON welfare_evidence (road_vehicle_execution_id)
    WHERE event_type = 'FINAL_DESTINATION' AND road_vehicle_execution_id IS NOT NULL;
CREATE UNIQUE INDEX uq_welfare_evidence_air_final
    ON welfare_evidence (air_leg_execution_id)
    WHERE event_type = 'FINAL_DESTINATION' AND air_leg_execution_id IS NOT NULL;

CREATE TABLE proofs_of_delivery (
    id uuid PRIMARY KEY,
    road_vehicle_execution_id uuid REFERENCES road_vehicle_executions (id),
    air_leg_execution_id uuid REFERENCES air_leg_executions (id),
    recipient_name varchar(150) NOT NULL,
    proof_photo_url varchar(500) NOT NULL,
    handover_note text,
    confirmed_by_escort_id uuid NOT NULL REFERENCES users (id),
    delivered_at timestamp NOT NULL,
    created_at timestamp NOT NULL,
    CONSTRAINT pod_exactly_one_scope CHECK (
        (road_vehicle_execution_id IS NOT NULL AND air_leg_execution_id IS NULL)
        OR
        (road_vehicle_execution_id IS NULL AND air_leg_execution_id IS NOT NULL)
    ),
    CONSTRAINT pod_recipient_required CHECK (length(trim(recipient_name)) > 0)
);

CREATE INDEX idx_proofs_of_delivery_road_execution_id ON proofs_of_delivery (road_vehicle_execution_id);
CREATE INDEX idx_proofs_of_delivery_air_execution_id ON proofs_of_delivery (air_leg_execution_id);
CREATE INDEX idx_proofs_of_delivery_delivered_at ON proofs_of_delivery (delivered_at);
CREATE UNIQUE INDEX uq_proofs_of_delivery_road_execution
    ON proofs_of_delivery (road_vehicle_execution_id)
    WHERE road_vehicle_execution_id IS NOT NULL;
CREATE UNIQUE INDEX uq_proofs_of_delivery_air_execution
    ON proofs_of_delivery (air_leg_execution_id)
    WHERE air_leg_execution_id IS NOT NULL;

CREATE TABLE notifications (
    id uuid PRIMARY KEY,
    recipient_user_id uuid NOT NULL REFERENCES users (id),
    transport_order_id uuid NOT NULL REFERENCES transport_orders (id),
    notification_type notification_type NOT NULL,
    source_event_key varchar(255) NOT NULL,
    title varchar(200) NOT NULL,
    message text NOT NULL,
    created_at timestamp NOT NULL,
    read_at timestamp,
    UNIQUE (recipient_user_id, source_event_key)
);

CREATE INDEX idx_notifications_recipient_read_at ON notifications (recipient_user_id, read_at);
CREATE INDEX idx_notifications_transport_order_id ON notifications (transport_order_id);
CREATE INDEX idx_notifications_created_at ON notifications (created_at);

CREATE TABLE status_audit_logs (
    id uuid PRIMARY KEY,
    entity_type audit_entity_type NOT NULL,
    entity_id uuid NOT NULL,
    old_status varchar(80) NOT NULL,
    new_status varchar(80) NOT NULL,
    actor_kind audit_actor_kind NOT NULL,
    actor_user_id uuid REFERENCES users (id),
    reason text,
    occurred_at timestamp NOT NULL,
    CONSTRAINT audit_status_changed CHECK (old_status <> new_status),
    CONSTRAINT audit_actor_valid CHECK (
        (actor_kind = 'USER' AND actor_user_id IS NOT NULL)
        OR
        (actor_kind = 'SYSTEM' AND actor_user_id IS NULL)
    )
);

CREATE INDEX idx_status_audit_logs_entity_occurred_at
    ON status_audit_logs (entity_type, entity_id, occurred_at);
CREATE INDEX idx_status_audit_logs_actor_user_id ON status_audit_logs (actor_user_id);
CREATE INDEX idx_status_audit_logs_occurred_at ON status_audit_logs (occurred_at);
