# Sprint 3 legacy command retirement

Date: 2026-10-30

The one-off first-RouteLeg repair and execution-staff reassignment utilities
were used only to repair reviewed development/demo data created before the
Sprint 3 execution lifecycle was finalized. They are not part of the approved
runtime workflow and are no longer required after that migration completed.

The command entry points, their dedicated Spring Boot configurations, safety
helper, and mutation services have been removed from production source. This
also removes the direct JDBC reassignment path that could bypass the current
ROAD/AIR execution-staff overlap rules in `ExecutionStaffingService`.

The original implementation remains available in Git history at backup commit
`7581787763abe4a8790795a7d731cde922be0e3b` for audit purposes. It must not be
restored as an executable command. Any future data repair requires a new,
human-reviewed migration designed against the then-current domain invariants.
