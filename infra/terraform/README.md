# Azure pilot scaffold

This directory contains the first-pass Terraform scaffold for the Disease Comic Platform internal pilot runtime.

Included resources:
- resource group
- Log Analytics workspace
- Application Insights
- Storage account and private blob container
- Service Bus namespace and `render-execution` queue
- Key Vault
- PostgreSQL Flexible Server and database
- Container Apps environment
- API and worker Container Apps

What this scaffold is for:
- make the intended pilot topology explicit in-repo
- give the managed migration and restore-smoke scripts a concrete target
- establish the resource boundaries needed for render execution, work-item queueing, telemetry, and release-bundle storage

What this scaffold does not yet do:
- private networking and ingress hardening
- secret injection from Key Vault into Container Apps
- startup migration jobs
- scheduled restore-smoke jobs
- alert rules, dashboards, or retention-policy automation
- production-ready scaling and security baselines

Before use:
- fill the required variables
- confirm naming and region choices
- confirm backup and restore expectations
- provide the container image references for the API and worker
